"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/session";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_ACCOUNT = 8;
const MAX_PER_IP = 30;

export type LoginState = { error?: string };

const schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

// Compared against when the email is unknown so response time doesn't reveal valid accounts.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const { email, password } = parsed.data;

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = `${email}|${ip}`;

  // Throttling lives in the database (not process memory) so it holds across serverless instances.
  // Per email+IP, so a stranger hammering an account can't lock the real user out from their own IP.
  const since = new Date(Date.now() - WINDOW_MS);
  const [failsForAccount, failsFromIp] = await Promise.all([
    db.auditLog.count({ where: { action: "login.failed", detail: key, createdAt: { gte: since } } }),
    db.auditLog.count({ where: { action: "login.failed", detail: { endsWith: `|${ip}` }, createdAt: { gte: since } } }),
  ]);
  if (failsForAccount >= MAX_PER_ACCOUNT || failsFromIp >= MAX_PER_IP)
    return { error: "Too many failed attempts. Please wait 10 minutes and try again." };

  const user = await db.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.isActive || !valid) {
    await audit(user?.id ?? null, "login.failed", "User", user?.id, key);
    return { error: "Incorrect email or password." };
  }

  await createSession(user.id);
  await audit(user.id, "login.success", "User", user.id);

  const next = String(formData.get("next") ?? "");
  // Only allow same-site relative redirects.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
