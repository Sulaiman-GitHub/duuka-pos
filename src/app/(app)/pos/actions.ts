"use server";

import { revalidatePath } from "next/cache";
import { saleInputSchema, sellInShop, type SaleResult } from "@/lib/sales";
import { requirePermission } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export async function completeSale(input: unknown): Promise<SaleResult> {
  const user = await requirePermission("pos.sell");
  const parsed = saleInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await sellInShop(user.shopId, user, parsed.data, await getSettings(user.shopId));
  if (result.saleId) revalidatePath("/", "layout");
  return { error: result.error, saleId: result.saleId };
}
