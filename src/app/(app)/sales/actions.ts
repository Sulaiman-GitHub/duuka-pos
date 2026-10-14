"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { createReturn, returnInputSchema, type ReturnResult } from "@/lib/returns";
import { requirePermission } from "@/lib/session";

export async function processReturn(input: unknown): Promise<ReturnResult> {
  const user = await requirePermission("sales.refund");
  const parsed = returnInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await createReturn(db, user, parsed.data);
  if (result.ok) {
    await audit(user.id, "sale.return", "Sale", parsed.data.saleId, parsed.data.reason);
    revalidatePath("/", "layout");
  }
  return { ok: result.ok, error: result.error };
}
