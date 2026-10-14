import { z } from "zod";
import type { Role } from "@/generated/prisma/enums";
import { audit } from "@/lib/audit";
import { applyStockChange, StockError } from "@/lib/inventory";
import { kampalaDateString } from "@/lib/time";
import { withShop, type Tx } from "@/lib/tenant";

// Domain logic for completing a sale. `createSale` runs inside a shop transaction and knows nothing about sessions
// or HTTP; `sellInShop` wraps it for callers (server actions, tests).

export const saleInputSchema = z.object({
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(100000) })).min(1, "The cart is empty.").max(200),
  discountType: z.enum(["amount", "percent"]),
  discountValue: z.number().min(0),
  paymentMethod: z.enum(["CASH", "MOBILE_MONEY", "CARD", "BANK_TRANSFER"]),
  amountPaid: z.number().int().min(0),
  customerName: z.string().trim().max(80).optional(),
  customerPhone: z.string().trim().max(30).optional(),
  reference: z.string().trim().max(80).optional(),
});
export type SaleInput = z.infer<typeof saleInputSchema>;
export type SaleResult = { error?: string; saleId?: string; receiptNo?: string };

export type Actor = { id: string; role: Role };

/**
 * Atomically allocates the next receipt number for this shop and Kampala day. The upsert takes a row lock, so two tills
 * finishing at the same moment queue up instead of colliding. A brand-new day's counter starts after any receipts that
 * already exist. The explicit ::int matters: a text parameter would turn SUBSTRING(... FROM n) into a regex search and
 * silently restart numbering at 1.
 */
async function nextReceiptNo(tx: Tx, shopId: string, now: Date) {
  const day = kampalaDateString(now);
  const prefix = `RCP-${day.replace(/-/g, "")}-`;
  const [row] = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "ReceiptCounter" ("shopId", day, last)
    VALUES (${shopId}, ${day}, 1 + COALESCE((SELECT MAX(CAST(SUBSTRING("receiptNo" FROM (${prefix.length + 1})::int) AS integer)) FROM "Sale" WHERE "shopId" = ${shopId} AND "receiptNo" LIKE ${prefix + "%"}), 0))
    ON CONFLICT ("shopId", day) DO UPDATE SET last = "ReceiptCounter".last + 1
    RETURNING last`;
  return prefix + String(row.last).padStart(4, "0");
}

/** Throws StockError (rolling the surrounding transaction back) when the sale can't be completed. */
export async function createSale(tx: Tx, shopId: string, actor: Actor, input: SaleInput, rules: { cashierMaxDiscountPercent: number }, now = new Date()) {
  // Merge duplicate lines so stock is checked against the combined quantity.
  const qty = new Map<string, number>();
  for (const it of input.items) qty.set(it.productId, (qty.get(it.productId) ?? 0) + it.quantity);

  // The shop context hides other shops' products, so an id from another shop simply "no longer exists".
  const products = await tx.product.findMany({ where: { id: { in: [...qty.keys()] } }, select: { id: true, name: true, sku: true, sellPrice: true, costPrice: true, isActive: true } });
  if (products.length !== qty.size) throw new StockError("A product in the cart no longer exists.");

  // Prices always come from the database, never from the browser.
  const lines = products.map((p) => {
    if (!p.isActive) throw new StockError(`"${p.name}" is inactive and can't be sold.`);
    const quantity = qty.get(p.id)!;
    return { p, quantity, lineTotal: p.sellPrice * quantity };
  });
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  const discount = input.discountType === "percent" ? Math.round((subtotal * input.discountValue) / 100) : Math.round(input.discountValue);
  if (discount > subtotal) throw new StockError("Discount cannot exceed the subtotal.");
  if (actor.role === "CASHIER" && discount > (subtotal * rules.cashierMaxDiscountPercent) / 100)
    throw new StockError(`Cashiers can give at most ${rules.cashierMaxDiscountPercent}% discount. Ask a manager to approve more.`);
  const total = subtotal - discount;

  let amountPaid = input.amountPaid;
  if (input.paymentMethod === "CASH") {
    if (amountPaid < total) throw new StockError("Cash received is less than the total.");
  } else amountPaid = total;

  const receiptNo = await nextReceiptNo(tx, shopId, now);
  const sale = await tx.sale.create({
    data: {
      receiptNo, cashierId: actor.id, subtotal, discount, total, paymentMethod: input.paymentMethod, amountPaid, changeGiven: amountPaid - total,
      customerName: input.customerName || null, customerPhone: input.customerPhone || null, note: input.reference || null,
      items: { create: lines.map((l) => ({ productId: l.p.id, productName: l.p.name, sku: l.p.sku, quantity: l.quantity, unitPrice: l.p.sellPrice, unitCost: l.p.costPrice, lineTotal: l.lineTotal })) },
    },
  });
  for (const l of lines) await applyStockChange(tx, l.p.id, -l.quantity, "SALE", { userId: actor.id, reference: receiptNo });
  await audit(tx, shopId, actor.id, "sale.create", "Sale", sale.id, `${receiptNo} total ${total}`);
  return { saleId: sale.id, receiptNo };
}

/** Completes a sale for a shop in one all-or-nothing transaction. */
export async function sellInShop(shopId: string, actor: Actor, input: SaleInput, rules: { cashierMaxDiscountPercent: number }, now = new Date()): Promise<SaleResult> {
  try {
    return await withShop(shopId, (tx) => createSale(tx, shopId, actor, input, rules, now));
  } catch (e) {
    if (e instanceof StockError) return { error: e.message };
    throw e;
  }
}
