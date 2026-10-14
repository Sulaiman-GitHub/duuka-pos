import bcrypt from "bcryptjs";
import { audit } from "@/lib/audit";
import { categoriesFor } from "@/lib/templates";
import type { Tx } from "@/lib/tenant";

export class EmailTakenError extends Error {}

export type NewShop = { shopName: string; address: string; phone: string; adminName: string; adminEmail: string; adminPassword: string; businessTypes: string[] };

/**
 * Creates a shop with its first administrator and the starter categories for what it sells. Must run at platform level
 * (the platform owner's context). An email belongs to exactly one shop across the whole platform.
 */
export async function createShopWithAdmin(tx: Tx, ownerId: string, d: NewShop) {
  if (await tx.user.findUnique({ where: { email: d.adminEmail }, select: { id: true } })) throw new EmailTakenError();
  const passwordHash = await bcrypt.hash(d.adminPassword, 10);
  const shop = await tx.shop.create({ data: { name: d.shopName, address: d.address, phone: d.phone } });
  const admin = await tx.user.create({ data: { shopId: shop.id, name: d.adminName, email: d.adminEmail, role: "ADMIN", passwordHash } });
  await tx.category.createMany({ data: categoriesFor(d.businessTypes).map((name) => ({ shopId: shop.id, name })) });
  await audit(tx, shop.id, ownerId, "shop.create", "Shop", shop.id, `${d.shopName} (${d.businessTypes.join(", ")})`);
  return { shopId: shop.id, adminId: admin.id };
}
