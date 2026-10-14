"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { createSale, saleInputSchema, type SaleResult } from "@/lib/sales";
import { requirePermission } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export async function completeSale(input: unknown): Promise<SaleResult> {
  const user = await requirePermission("pos.sell");
  const parsed = saleInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await createSale(db, user, parsed.data, await getSettings());
  if (result.saleId) {
    await audit(user.id, "sale.create", "Sale", result.saleId, result.receiptNo);
    revalidatePath("/", "layout");
  }
  return { error: result.error, saleId: result.saleId };
}
