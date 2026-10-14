import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import { can, type Permission } from "@/lib/permissions";

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

export type SessionUser = { id: string; name: string; email: string; role: Role };

// Re-reads the user from the DB so deactivated accounts and role changes apply immediately.
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const user = await db.user.findUnique({
      where: { id: String(payload.uid) },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) return null;
    return { id: user.id, name: user.name, email: user.email, role: user.role };
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

export async function requirePermission(perm: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, perm)) throw new AuthError("You do not have permission to do that");
  return user;
}

export const COOKIE_NAME = COOKIE;
