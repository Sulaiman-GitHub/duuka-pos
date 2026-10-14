"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { applyStockChange, StockError } from "@/lib/inventory";
import { requirePermission } from "@/lib/session";

export type AdjustState = { error?: string; values?: Record<string, string> };

const schema = z.object({
  productId: z.string().min(1, "Choose a product"),
  mode: z.enum(["ADD", "REMOVE", "DAMAGE", "SET"]),
  quantity: z.coerce.number({ message: "Enter a quantity" }).int("Whole numbers only").min(0, "Cannot be negative"),
  reason: z.string().trim().min(3, "Please give a short reason").max(200),
});

export async function adjustStock(_prev: AdjustState, formData: FormData): Promise<AdjustState> {
  const user = await requirePermission("inventory.adjust");
  const values = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const { productId, mode, quantity, reason } = parsed.data;
  if (mode !== "SET" && quantity === 0) return { error: "Quantity must be greater than zero.", values };

  try {
    await db.$transaction(async (tx) => {
      const p = await tx.product.findUnique({ where: { id: productId }, select: { stock: true } });
      if (!p) throw new StockError("Product not found.");
      const delta = mode === "SET" ? quantity - p.stock : mode === "ADD" ? quantity : -quantity;
      if (delta === 0) throw new StockError("Stock is already at that level.");
      const type = mode === "DAMAGE" ? "DAMAGE" : delta > 0 ? "ADJUSTMENT_ADD" : "ADJUSTMENT_REMOVE";
      await applyStockChange(tx, productId, delta, type, { userId: user.id, reason, allowInactive: true });
    });
  } catch (e) {
    if (e instanceof StockError) return { error: e.message, values };
    throw e;
  }
  await audit(user.id, "stock.adjust", "Product", productId, `${mode} ${quantity}: ${reason}`);
  revalidatePath("/inventory", "layout");
  revalidatePath("/products");
  redirect("/inventory/history");
}
