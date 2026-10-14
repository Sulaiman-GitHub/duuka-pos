"use server";

import { revalidatePath } from "next/cache";
import { returnInShop, returnInputSchema, type ReturnResult } from "@/lib/returns";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { withShop } from "@/lib/tenant";

export async function processReturn(input: unknown): Promise<ReturnResult> {
  const user = await requirePermission("sales.refund");
  const parsed = returnInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await returnInShop(user.shopId, user, parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return { ok: result.ok, error: result.error };
}

/** A manager has looked at a flagged offline sale and is satisfied with it. */
export async function markReviewed(id: string) {
  const user = await requirePermission("sales.refund");
  await withShop(user.shopId, async (tx) => {
    const r = await tx.sale.updateMany({ where: { id, needsReview: true }, data: { needsReview: false } });
    if (r.count) await audit(tx, user.shopId, user.id, "sale.reviewed", "Sale", id);
  });
  revalidatePath("/sales");
  revalidatePath(`/sales/${id}`);
}
