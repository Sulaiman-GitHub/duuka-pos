"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export type SettingsState = { error?: string; ok?: string };

const schema = z.object({
  name: z.string().trim().min(2, "Shop name is required").max(80),
  address: z.string().trim().min(2, "Address is required").max(160),
  phone: z.string().trim().min(3, "Phone is required").max(50),
  receiptFooter: z.string().trim().max(160),
  cashierMaxDiscountPercent: z.coerce.number({ message: "Discount limit must be a number" }).int("Whole numbers only").min(0).max(100),
});

export async function saveSettings(_p: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await requirePermission("settings.manage");
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.shopSettings.upsert({ where: { id: "main" }, create: { id: "main", ...parsed.data }, update: parsed.data });
  await audit(user.id, "settings.update", "ShopSettings", "main", parsed.data.name);
  revalidatePath("/", "layout");
  return { ok: "Settings saved." };
}
