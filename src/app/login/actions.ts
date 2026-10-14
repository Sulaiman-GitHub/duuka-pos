"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auditPlatform } from "@/lib/audit";
import { asPlatform } from "@/lib/tenant";
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
  const [failsForAccount, failsFromIp] = await asPlatform((tx) =>
    Promise.all([
      tx.auditLog.count({ where: { action: "login.failed", detail: key, createdAt: { gte: since } } }),
      tx.auditLog.count({ where: { action: "login.failed", detail: { endsWith: `|${ip}` }, createdAt: { gte: since } } }),
    ]),
  );
  if (failsForAccount >= MAX_PER_ACCOUNT || failsFromIp >= MAX_PER_IP)
    return { error: "Too many failed attempts. Please wait 10 minutes and try again." };

  // The shop isn't known until the account is found, so this one lookup is done at platform level.
  const user = await asPlatform((tx) => tx.user.findUnique({ where: { email }, include: { shop: { select: { isActive: true } } } }));
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.isActive || !valid) {
    await auditPlatform(user?.shopId ?? null, user?.id ?? null, "login.failed", "User", user?.id, key);
    return { error: "Incorrect email or password." };
  }

  // Correct password, but the shop has been suspended by the platform.
  if (user.role !== "PLATFORM_OWNER" && !user.shop?.isActive) return { error: "This shop's account is suspended. Please contact support." };

  await createSession(user.id);
  await auditPlatform(user.shopId, user.id, "login.success", "User", user.id);

  const next = String(formData.get("next") ?? "");
  // Only allow same-site relative redirects.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
