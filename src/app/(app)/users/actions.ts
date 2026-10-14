"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export type UserFormState = { error?: string; ok?: string; values?: Record<string, string> };

const echo = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
const password = z.string().min(8, "Password must be at least 8 characters").max(72, "Password is too long");
const base = { name: z.string().trim().min(2, "Name is required").max(80), role: z.enum(["ADMIN", "MANAGER", "CASHIER"]) };

export async function createUser(_p: UserFormState, fd: FormData): Promise<UserFormState> {
  const me = await requirePermission("users.manage");
  const values = { ...echo(fd), password: "" };
  const parsed = z.object({ ...base, email: z.string().trim().toLowerCase().email("Enter a valid email"), password }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  try {
    const u = await db.user.create({ data: { name: parsed.data.name, email: parsed.data.email, role: parsed.data.role, passwordHash: await bcrypt.hash(parsed.data.password, 10) } });
    await audit(me.id, "user.create", "User", u.id, `${u.email} (${u.role})`);
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { error: "A user with that email already exists.", values };
    throw e;
  }
  revalidatePath("/users");
  redirect("/users");
}

/** An admin may not lock themselves out, and the system must always keep at least one active admin. */
async function guardAdminLoss(tx: Pick<typeof db, "user">, meId: string, targetId: string, newRole: string, newActive: boolean) {
  const target = await tx.user.findUnique({ where: { id: targetId }, select: { role: true, isActive: true } });
  if (!target) return "User not found.";
  const losingAdmin = target.role === "ADMIN" && target.isActive && (newRole !== "ADMIN" || !newActive);
  if (!losingAdmin) return null;
  if (targetId === meId) return "You can't remove your own admin access or deactivate yourself.";
  const others = await tx.user.count({ where: { role: "ADMIN", isActive: true, id: { not: targetId } } });
  return others === 0 ? "There must be at least one active admin." : null;
}

export async function updateUser(id: string, _p: UserFormState, fd: FormData): Promise<UserFormState> {
  const me = await requirePermission("users.manage");
  const parsed = z.object(base).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const isActive = fd.get("isActive") === "on";
  const problem = await guardAdminLoss(db, me.id, id, parsed.data.role, isActive);
  if (problem) return { error: problem };
  await db.user.update({ where: { id }, data: { name: parsed.data.name, role: parsed.data.role, isActive } });
  await audit(me.id, "user.update", "User", id, `${parsed.data.role}, ${isActive ? "active" : "inactive"}`);
  revalidatePath("/users");
  redirect("/users");
}

export async function resetPassword(id: string, _p: UserFormState, fd: FormData): Promise<UserFormState> {
  const me = await requirePermission("users.manage");
  const parsed = password.safeParse(fd.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(parsed.data, 10) } });
  await audit(me.id, "user.password_reset", "User", id);
  return { ok: "Password updated." };
}
