"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { STAFF_ROLES } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { asPlatform, withShop, type Tx } from "@/lib/tenant";

export type UserFormState = { error?: string; ok?: string; values?: Record<string, string> };

const echo = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
const password = z.string().min(8, "Password must be at least 8 characters").max(72, "Password is too long");
// A shop admin can only create staff roles; the platform-owner role can never be assigned from inside a shop.
const base = { name: z.string().trim().min(2, "Name is required").max(80), role: z.enum(STAFF_ROLES) };

export async function createUser(_p: UserFormState, fd: FormData): Promise<UserFormState> {
  const me = await requirePermission("users.manage");
  const values = { ...echo(fd), password: "" };
  const parsed = z.object({ ...base, email: z.string().trim().toLowerCase().email("Enter a valid email"), password }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  // An email belongs to exactly one shop across the whole platform, so the uniqueness check must look at every shop.
  // The message deliberately doesn't say which shop already uses it.
  const taken = await asPlatform((tx) => tx.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } }));
  if (taken) return { error: "That email address is already in use.", values };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  try {
    await withShop(me.shopId, async (tx) => {
      const u = await tx.user.create({ data: { shopId: me.shopId, name: parsed.data.name, email: parsed.data.email, role: parsed.data.role, passwordHash } });
      await audit(tx, me.shopId, me.id, "user.create", "User", u.id, `${u.email} (${u.role})`);
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { error: "That email address is already in use.", values };
    throw e;
  }
  revalidatePath("/users");
  redirect("/users");
}

/** An admin may not lock themselves out, and a shop must always keep at least one active admin. */
async function guardAdminLoss(tx: Tx, meId: string, targetId: string, newRole: string, newActive: boolean) {
  const target = await tx.user.findUnique({ where: { id: targetId }, select: { role: true, isActive: true } });
  if (!target) return "User not found.";
  const losingAdmin = target.role === "ADMIN" && target.isActive && (newRole !== "ADMIN" || !newActive);
  if (!losingAdmin) return null;
  if (targetId === meId) return "You can't remove your own admin access or deactivate yourself.";
  const others = await tx.user.count({ where: { role: "ADMIN", isActive: true, id: { not: targetId } } });
  return others === 0 ? "A shop must have at least one active admin." : null;
}

export async function updateUser(id: string, _p: UserFormState, fd: FormData): Promise<UserFormState> {
  const me = await requirePermission("users.manage");
  const parsed = z.object(base).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const isActive = fd.get("isActive") === "on";
  const problem = await withShop(me.shopId, async (tx) => {
    const p = await guardAdminLoss(tx, me.id, id, parsed.data.role, isActive);
    if (p) return p;
    // Other shops' users are invisible here, so this only ever updates a member of this shop.
    const r = await tx.user.updateMany({ where: { id }, data: { name: parsed.data.name, role: parsed.data.role, isActive } });
    if (r.count === 0) return "User not found.";
    await audit(tx, me.shopId, me.id, "user.update", "User", id, `${parsed.data.role}, ${isActive ? "active" : "inactive"}`);
    return null;
  });
  if (problem) return { error: problem };
  revalidatePath("/users");
  redirect("/users");
}

export async function resetPassword(id: string, _p: UserFormState, fd: FormData): Promise<UserFormState> {
  const me = await requirePermission("users.manage");
  const parsed = password.safeParse(fd.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const passwordHash = await bcrypt.hash(parsed.data, 10);
  const updated = await withShop(me.shopId, async (tx) => {
    const r = await tx.user.updateMany({ where: { id }, data: { passwordHash } });
    if (r.count) await audit(tx, me.shopId, me.id, "user.password_reset", "User", id);
    return r.count;
  });
  if (!updated) return { error: "User not found." };
  return { ok: "Password updated." };
}
