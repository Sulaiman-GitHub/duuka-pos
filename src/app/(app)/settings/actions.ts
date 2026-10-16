"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { withShop } from "@/lib/tenant";

export type SettingsState = { error?: string; ok?: string };

const schema = z.object({
  name: z.string().trim().min(2, "Shop name is required").max(80),
  address: z.string().trim().min(2, "Address is required").max(160),
  phone: z.string().trim().min(3, "Phone is required").max(50),
  receiptFooter: z.string().trim().max(160),
  expiryAlertDays: z.coerce.number({ message: "Expiry warning must be a number of days" }).int("Whole days only").min(1, "At least 1 day").max(365, "At most 365 days"),
  receiptWidth: z.coerce.number().refine((w) => w === 58 || w === 80, "Choose 58 mm or 80 mm paper"),
  cashierMaxDiscountPercent: z.coerce.number({ message: "Discount limit must be a number" }).int("Whole numbers only").min(0).max(100),
});

export async function saveSettings(_p: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await requirePermission("settings.manage");
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await withShop(user.shopId, async (tx) => {
    await tx.shop.update({ where: { id: user.shopId }, data: parsed.data });
    await audit(tx, user.shopId, user.id, "settings.update", "Shop", user.shopId, parsed.data.name);
  });
  revalidatePath("/", "layout");
  return { ok: "Settings saved." };
}
