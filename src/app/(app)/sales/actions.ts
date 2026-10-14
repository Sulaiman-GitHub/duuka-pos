"use server";

import { revalidatePath } from "next/cache";
import { returnInShop, returnInputSchema, type ReturnResult } from "@/lib/returns";
import { requirePermission } from "@/lib/session";

export async function processReturn(input: unknown): Promise<ReturnResult> {
  const user = await requirePermission("sales.refund");
  const parsed = returnInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await returnInShop(user.shopId, user, parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return { ok: result.ok, error: result.error };
}
