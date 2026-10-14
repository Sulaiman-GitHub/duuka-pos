import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { applyStockChange, StockError } from "@/lib/inventory";

// Domain logic for returns/refunds (database client passed in, no session/HTTP knowledge) so it can be tested directly.

export const returnInputSchema = z.object({
  saleId: z.string().min(1),
  reason: z.string().trim().min(3, "Please give a reason for the return.").max(200),
  restock: z.boolean(),
  items: z.array(z.object({ saleItemId: z.string().min(1), quantity: z.number().int().min(0) })),
});
export type ReturnInput = z.infer<typeof returnInputSchema>;
export type ReturnResult = { error?: string; ok?: boolean; refundTotal?: number };

export async function createReturn(db: PrismaClient, actor: { id: string }, d: ReturnInput): Promise<ReturnResult> {
  // Merge repeated lines for the same sale item: each line alone could pass the "still returnable" check
  // while together they exceed what was sold.
  const merged = new Map<string, number>();
  for (const i of d.items) if (i.quantity > 0) merged.set(i.saleItemId, (merged.get(i.saleItemId) ?? 0) + i.quantity);
  if (merged.size === 0) return { error: "Choose at least one item to return." };

  try {
    const refundTotal = await db.$transaction(async (tx) => {
      // Lock the sale row so two simultaneous returns can't both refund the same items.
      await tx.$queryRaw`SELECT id FROM "Sale" WHERE id = ${d.saleId} FOR UPDATE`;
      const sale = await tx.sale.findUnique({
        where: { id: d.saleId },
        include: { items: { include: { returns: { select: { quantity: true } } } }, returns: { select: { refundTotal: true } } },
      });
      if (!sale) throw new StockError("Sale not found.");

      const alreadyRefunded = sale.returns.reduce((s, r) => s + r.refundTotal, 0);
      const share = sale.subtotal > 0 ? sale.total / sale.subtotal : 1; // the sale-level discount is shared proportionally across items
      const lines = [...merged].map(([saleItemId, quantity]) => {
        const item = sale.items.find((i) => i.id === saleItemId);
        if (!item) throw new StockError("An item does not belong to this sale.");
        const returned = item.returns.reduce((s, x) => s + x.quantity, 0);
        if (quantity > item.quantity - returned) throw new StockError(`Only ${item.quantity - returned} of "${item.productName}" can still be returned.`);
        return { item, quantity, refund: Math.round(item.unitPrice * quantity * share) };
      });

      // If this return completes the sale, settle any rounding difference so refunds sum exactly to the total paid.
      const fullyReturned = sale.items.every((i) => {
        const l = lines.find((x) => x.item.id === i.id);
        return i.returns.reduce((s, x) => s + x.quantity, 0) + (l?.quantity ?? 0) === i.quantity;
      });
      let total = lines.reduce((s, l) => s + l.refund, 0);
      if (fullyReturned) {
        const diff = sale.total - alreadyRefunded - total;
        lines[lines.length - 1].refund += diff;
        total += diff;
      }
      if (alreadyRefunded + total > sale.total) throw new StockError("Refund would exceed the amount paid.");

      await tx.saleReturn.create({
        data: {
          saleId: sale.id, processedBy: actor.id, reason: d.reason, refundTotal: total,
          items: { create: lines.map((l) => ({ saleItemId: l.item.id, quantity: l.quantity, refundAmount: l.refund })) },
        },
      });
      if (d.restock)
        for (const l of lines) await applyStockChange(tx, l.item.productId, l.quantity, "RETURN", { userId: actor.id, reference: sale.receiptNo, reason: d.reason, allowInactive: true });
      await tx.sale.update({ where: { id: sale.id }, data: { status: fullyReturned ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
      return total;
    });
    return { ok: true, refundTotal };
  } catch (e) {
    if (e instanceof StockError) return { error: e.message };
    throw e;
  }
}
