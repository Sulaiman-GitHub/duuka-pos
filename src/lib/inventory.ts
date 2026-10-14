import type { Prisma } from "@/generated/prisma/client";
import type { StockMovementType } from "@/generated/prisma/enums";

export class StockError extends Error {}

type Tx = Prisma.TransactionClient;

/**
 * The only way stock should change. Applies a signed delta atomically (the DB rejects it if it would go
 * below zero, even under concurrent sales) and appends a ledger row. Must be called inside a transaction.
 */
export async function applyStockChange(
  tx: Tx,
  productId: string,
  delta: number,
  type: StockMovementType,
  opts: { userId?: string | null; reason?: string | null; reference?: string | null; allowInactive?: boolean } = {},
) {
  if (!Number.isInteger(delta) || delta === 0) throw new StockError("Quantity must be a non-zero whole number.");

  const updated = await tx.product.updateMany({
    where: {
      id: productId,
      ...(opts.allowInactive ? {} : delta < 0 ? { isActive: true } : {}),
      ...(delta < 0 ? { stock: { gte: -delta } } : {}),
    },
    data: { stock: { increment: delta } },
  });
  if (updated.count === 0) {
    const p = await tx.product.findUnique({ where: { id: productId }, select: { name: true, stock: true, isActive: true } });
    if (!p) throw new StockError("Product not found.");
    if (!p.isActive && delta < 0) throw new StockError(`"${p.name}" is inactive and can't be sold.`);
    throw new StockError(`Not enough stock for "${p.name}" (only ${p.stock} left).`);
  }

  const { stock } = await tx.product.findUniqueOrThrow({ where: { id: productId }, select: { stock: true } });
  await tx.stockMovement.create({
    data: { productId, type, quantity: delta, stockAfter: stock, reason: opts.reason ?? null, reference: opts.reference ?? null, userId: opts.userId ?? null },
  });
  return stock;
}
