"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/lib/money";
import { issueLink } from "@/lib/tokens";
import { requirePlatformOwner } from "@/lib/session";
import { createShopWithAdmin, EmailTakenError } from "@/lib/shops";
import { BUSINESS_TYPES } from "@/lib/templates";
import { asPlatform } from "@/lib/tenant";

export type PlatformFormState = { error?: string; ok?: string; link?: string; openId?: string; values?: Record<string, string | string[]> };

const password = z.string().min(8, "Password must be at least 8 characters").max(72, "Password is too long");
// Echoes submitted text back to the form after an error (never the password).
const echo = (fd: FormData) => {
  const out: Record<string, string | string[]> = {};
  for (const k of new Set(fd.keys())) {
    if (k === "adminPassword") continue;
    const all = fd.getAll(k).filter((v): v is string => typeof v === "string");
    out[k] = k === "types" ? all : (all[0] ?? "");
  }
  return out;
};

const shopFields = {
  shopName: z.string().trim().min(2, "Shop name is required").max(80),
  address: z.string().trim().max(160).default(""),
  phone: z.string().trim().max(50).default(""),
  currency: z.enum(Object.keys(CURRENCIES) as [string, ...string[]]).default(DEFAULT_CURRENCY),
};

/** Creates a shop together with its first administrator and the starter categories for what it sells. */
export async function createShop(_p: PlatformFormState, fd: FormData): Promise<PlatformFormState> {
  const owner = await requirePlatformOwner();
  const values = echo(fd);
  const types = fd.getAll("types").map(String).filter((t) => BUSINESS_TYPES.some((b) => b.key === t));
  const parsed = z
    .object({ ...shopFields, adminName: z.string().trim().min(2, "Admin name is required").max(80), adminEmail: z.string().trim().toLowerCase().email("Enter a valid admin email"), adminPassword: z.union([z.literal(""), password]) })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  if (types.length === 0) return { error: "Choose at least one kind of business so the shop gets starter categories.", values };
  const d = parsed.data;

  const invite = d.adminPassword === "";
  let shopId: string, adminId: string;
  try {
    ({ shopId, adminId } = await asPlatform((tx) => createShopWithAdmin(tx, owner.id, { ...d, adminPassword: invite ? null : d.adminPassword, businessTypes: types })));
  } catch (e) {
    if (e instanceof EmailTakenError || (e as { code?: string }).code === "P2002") return { error: "That admin email address is already in use.", values };
    throw e;
  }
  revalidatePath("/platform");
  if (!invite) redirect(`/platform/shops/${shopId}`);
  const { url, sent } = await issueLink(adminId, "INVITE", { email: d.adminEmail, name: d.adminName }, d.shopName);
  return {
    ok: sent ? `Shop created. An invitation was emailed to ${d.adminEmail}.` : "Shop created. Email isn't set up yet, so send this link to the shop's administrator yourself (valid for 7 days):",
    link: sent ? undefined : url,
    openId: shopId,
  };
}

export async function updateShop(id: string, _p: PlatformFormState, fd: FormData): Promise<PlatformFormState> {
  const owner = await requirePlatformOwner();
  const parsed = z.object(shopFields).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const currencyLocked = await asPlatform(async (tx) => {
    const current = await tx.shop.findUnique({ where: { id }, select: { currency: true } });
    // Amounts are stored without a currency, so it can only change while the shop has no sales to be mislabelled.
    const locked = parsed.data.currency !== current?.currency && (await tx.sale.count({ where: { shopId: id } })) > 0;
    await tx.shop.update({ where: { id }, data: { name: parsed.data.shopName, address: parsed.data.address, phone: parsed.data.phone, ...(locked ? {} : { currency: parsed.data.currency }) } });
    await audit(tx, id, owner.id, "shop.update", "Shop", id, `${parsed.data.shopName} (${locked ? current?.currency : parsed.data.currency})`);
    return locked;
  });
  revalidatePath("/platform", "layout");
  return currencyLocked ? { ok: "Saved, except the currency: it can't change once the shop has recorded sales." } : { ok: "Shop details saved." };
}

/** Suspending a shop stops all of its staff from signing in (and ends their open sessions); its data is kept. */
export async function setShopActive(id: string, active: boolean) {
  const owner = await requirePlatformOwner();
  await asPlatform(async (tx) => {
    await tx.shop.update({ where: { id }, data: { isActive: active } });
    await audit(tx, id, owner.id, active ? "shop.activate" : "shop.suspend", "Shop", id);
  });
  revalidatePath("/platform", "layout");
}

/** Resets the password of a member of a shop (for example when the shop's admin has forgotten theirs). */
export async function resetShopUserPassword(userId: string, _p: PlatformFormState, fd: FormData): Promise<PlatformFormState> {
  const owner = await requirePlatformOwner();
  const parsed = password.safeParse(fd.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const passwordHash = await bcrypt.hash(parsed.data, 10);
  const done = await asPlatform(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: userId }, select: { id: true, shopId: true, role: true } });
    if (!u || u.role === "PLATFORM_OWNER") return false; // never touch platform-owner accounts from here
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await audit(tx, u.shopId, owner.id, "user.password_reset", "User", userId, "by platform owner");
    return true;
  });
  return done ? { ok: "Password updated." } : { error: "User not found." };
}
