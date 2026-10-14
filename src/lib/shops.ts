import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { audit } from "@/lib/audit";
import { DEFAULT_CURRENCY } from "@/lib/money";
import { addDays } from "@/lib/time";
import { getPlatformSettings } from "@/lib/billing";
import { categoriesFor } from "@/lib/templates";
import type { Tx } from "@/lib/tenant";

export class EmailTakenError extends Error {}

export type NewShop = { shopName: string; address: string; phone: string; adminName: string; adminEmail: string; adminPassword: string | null; businessTypes: string[]; currency?: string };

/**
 * Creates a shop with its first administrator and the starter categories for what it sells. Must run at platform level
 * (the platform owner's context). An email belongs to exactly one shop across the whole platform.
 */
export async function createShopWithAdmin(tx: Tx, ownerId: string, d: NewShop) {
  if (await tx.user.findUnique({ where: { email: d.adminEmail }, select: { id: true } })) throw new EmailTakenError();
  // No password given = the admin is invited and chooses their own (the caller issues the link).
  const passwordHash = await bcrypt.hash(d.adminPassword ?? randomBytes(24).toString("base64url"), 10);
  const { trialDays } = await getPlatformSettings(tx);
  const shop = await tx.shop.create({ data: { name: d.shopName, address: d.address, phone: d.phone, currency: d.currency ?? DEFAULT_CURRENCY, trialEndsAt: addDays(new Date(), trialDays) } });
  const admin = await tx.user.create({ data: { shopId: shop.id, name: d.adminName, email: d.adminEmail, role: "ADMIN", passwordHash } });
  await tx.category.createMany({ data: categoriesFor(d.businessTypes).map((name) => ({ shopId: shop.id, name })) });
  await audit(tx, shop.id, ownerId, "shop.create", "Shop", shop.id, `${d.shopName} (${d.businessTypes.join(", ")})`);
  return { shopId: shop.id, adminId: admin.id };
}
