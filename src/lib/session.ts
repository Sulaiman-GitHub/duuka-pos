import { DEFAULT_CURRENCY } from "@/lib/money";
import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Role } from "@/generated/prisma/enums";
import { can, type PlatformPermission, type ShopPermission } from "@/lib/permissions";
import { asPlatform } from "@/lib/tenant";

const COOKIE = "pos_session";
const MAX_AGE = 60 * 60 * 12; // 12 hours

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export type SessionUser = { id: string; name: string; email: string; role: Role; shopId: string | null; shopName: string | null; currency: string };
/** A signed-in member of a shop (admin, manager or cashier). */
export type ShopUser = SessionUser & { shopId: string; shopName: string };

// Re-reads the user (and their shop) on every request, so deactivating an account or a whole shop, or changing a role,
// applies immediately. This is the one place that looks a user up before a shop is known, hence `asPlatform`.
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const user = await asPlatform((tx) =>
      tx.user.findUnique({
        where: { id: String(payload.uid) },
        select: { id: true, name: true, email: true, role: true, isActive: true, shop: { select: { id: true, name: true, isActive: true, currency: true } } },
      }),
    );
    if (!user || !user.isActive) return null;
    if (user.role !== "PLATFORM_OWNER" && !user.shop?.isActive) return null; // a suspended shop locks out all its staff
    return { id: user.id, name: user.name, email: user.email, role: user.role, shopId: user.shop?.id ?? null, shopName: user.shop?.name ?? null, currency: user.shop?.currency ?? DEFAULT_CURRENCY };
  } catch {
    return null;
  }
});

export class AuthError extends Error {}

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new AuthError("Not signed in");
  return user;
}

/** For actions inside a shop: the signed-in user must be a member of a shop and hold the permission. */
export async function requirePermission(perm: ShopPermission): Promise<ShopUser> {
  const user = await requireUser();
  if (!user.shopId || !user.shopName || !can(user.role, perm)) throw new AuthError("You do not have permission to do that");
  return user as ShopUser;
}

/** For platform actions: only the platform owner. */
export async function requirePlatformOwner(perm: PlatformPermission = "platform.manage"): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, perm)) throw new AuthError("You do not have permission to do that");
  return user;
}

export const COOKIE_NAME = COOKIE;
