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
export type SaleResult = { error?: string; saleId?: string; receiptNo?: string; duplicate?: boolean; flagged?: string };

/** What a till sends for one sale. `live` = made while online (strict rules); `offline` = already happened, upload it. */
export const syncSaleSchema = saleInputSchema.extend({
  clientId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  mode: z.enum(["live", "offline"]),
  cashierId: z.string().max(64).optional(),
  offlineAt: z.string().datetime().optional(),
  catalogAt: z.string().datetime().optional(),
  expectedTotal: z.number().int().min(0).optional(),
  // Unit prices the till showed the customer (offline sales only).
  prices: z.record(z.string(), z.number().int().min(0)).optional(),
});
export type SyncSale = z.infer<typeof syncSaleSchema>;

/** Extra context for a sale made on a till rather than typed in just now. */
export type TillContext = { clientId: string; offline?: { at: Date; catalogAt: Date | null; prices: Record<string, number>; expectedTotal?: number } };

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
export async function createSale(tx: Tx, shopId: string, actor: Actor, input: SaleInput, rules: { cashierMaxDiscountPercent: number }, now = new Date(), till?: TillContext): Promise<SaleResult & { saleId: string; receiptNo: string }> {
  if (till) {
    const existing = await tx.sale.findFirst({ where: { clientId: till.clientId }, select: { id: true, receiptNo: true } });
    if (existing) return { saleId: existing.id, receiptNo: existing.receiptNo, duplicate: true };
  }
  const offline = till?.offline;
  const flags: string[] = [];

  // Merge duplicate lines so stock is checked against the combined quantity.
  const qty = new Map<string, number>();
  for (const it of input.items) qty.set(it.productId, (qty.get(it.productId) ?? 0) + it.quantity);

  // The shop context hides other shops' products, so an id from another shop simply "no longer exists".
  const products = await tx.product.findMany({ where: { id: { in: [...qty.keys()] } }, select: { id: true, name: true, sku: true, sellPrice: true, costPrice: true, isActive: true, updatedAt: true } });
  if (products.length !== qty.size) throw new StockError("A product in the cart no longer exists.");

  // Prices come from the database, never from the browser. The one exception is an offline sale: the customer already
  // paid the price the till showed. That price is honoured only when the product's price could really have changed after
  // the till last synced (so a forged price on an untouched product is ignored), and the sale is flagged for review.
  const lines = products.map((p) => {
    if (!p.isActive && !offline) throw new StockError(`"${p.name}" is inactive and can't be sold.`);
    if (!p.isActive) flags.push(`"${p.name}" was deactivated before this sale was uploaded`);
    const quantity = qty.get(p.id)!;
    let unitPrice = p.sellPrice;
    const shown = offline?.prices[p.id];
    if (offline && shown !== undefined && shown !== p.sellPrice) {
      if (offline.catalogAt && p.updatedAt > offline.catalogAt) {
        unitPrice = shown;
        flags.push(`"${p.name}" was sold at ${shown}; its price has since changed to ${p.sellPrice}`);
      } else flags.push(`"${p.name}": the till showed ${shown} but the price is ${p.sellPrice}; the recorded price was used`);
    }
    return { p, quantity, unitPrice, lineTotal: unitPrice * quantity };
  });
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  let discount = input.discountType === "percent" ? Math.round((subtotal * input.discountValue) / 100) : Math.round(input.discountValue);
  if (discount > subtotal) {
    if (!offline) throw new StockError("Discount cannot exceed the subtotal.");
    discount = subtotal;
    flags.push("the discount exceeded the subtotal and was capped");
  }
  if (actor.role === "CASHIER" && discount > (subtotal * rules.cashierMaxDiscountPercent) / 100) {
    if (!offline) throw new StockError(`Cashiers can give at most ${rules.cashierMaxDiscountPercent}% discount. Ask a manager to approve more.`);
    flags.push(`the discount is above the cashier limit of ${rules.cashierMaxDiscountPercent}%`);
  }
  const total = subtotal - discount;
  if (offline?.expectedTotal !== undefined && offline.expectedTotal !== total) flags.push(`the till charged ${offline.expectedTotal} but the recorded total is ${total}`);

  let amountPaid = input.amountPaid;
  if (input.paymentMethod === "CASH") {
    if (amountPaid < total) {
      if (!offline) throw new StockError("Cash received is less than the total.");
      flags.push("cash received was less than the total");
      amountPaid = total;
    }
  } else amountPaid = total;

  const receiptNo = await nextReceiptNo(tx, shopId, now);
  const sale = await tx.sale.create({
    data: {
      receiptNo, cashierId: actor.id, subtotal, discount, total, paymentMethod: input.paymentMethod, amountPaid, changeGiven: amountPaid - total,
      customerName: input.customerName || null, customerPhone: input.customerPhone || null, note: input.reference || null,
      clientId: till?.clientId ?? null,
      // A till's clock can be wrong: never record a sale in the future.
      ...(offline ? { offlineAt: offline.at, createdAt: offline.at < now ? offline.at : now } : {}),
      items: { create: lines.map((l) => ({ productId: l.p.id, productName: l.p.name, sku: l.p.sku, quantity: l.quantity, unitPrice: l.unitPrice, unitCost: l.p.costPrice, lineTotal: l.lineTotal })) },
    },
  });
  for (const l of lines) {
    const left = await applyStockChange(tx, l.p.id, -l.quantity, "SALE", { userId: actor.id, reference: receiptNo, allowNegative: !!offline });
    if (offline && left < 0) flags.push(`"${l.p.name}": stock is now ${left}`);
  }
  const flagged = flags.length ? flags.join("; ") : undefined;
  if (flagged) await tx.sale.update({ where: { id: sale.id }, data: { needsReview: true, reviewNote: flagged.slice(0, 1000) } });
  await audit(tx, shopId, actor.id, offline ? "sale.create_offline" : "sale.create", "Sale", sale.id, `${receiptNo} total ${total}${flagged ? ` (review: ${flagged})` : ""}`.slice(0, 1000));
  return { saleId: sale.id, receiptNo, flagged };
}

/** Completes a sale for a shop in one all-or-nothing transaction. */
export async function sellInShop(shopId: string, actor: Actor, input: SaleInput, rules: { cashierMaxDiscountPercent: number }, now = new Date(), till?: TillContext): Promise<SaleResult> {
  try {
    return await withShop(shopId, (tx) => createSale(tx, shopId, actor, input, rules, now, till));
  } catch (e) {
    if (e instanceof StockError) return { error: e.message };
    // Two uploads of the same sale at once: the loser hits the unique (shop, clientId) index and just reports the winner.
    if (till && (e as { code?: string }).code === "P2002") {
      const existing = await withShop(shopId, (tx) => tx.sale.findFirst({ where: { clientId: till.clientId }, select: { id: true, receiptNo: true } }));
      if (existing) return { saleId: existing.id, receiptNo: existing.receiptNo, duplicate: true };
    }
    throw e;
  }
}
