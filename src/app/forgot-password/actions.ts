"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auditPlatform } from "@/lib/audit";
import { issueLink } from "@/lib/tokens";
import { asPlatform } from "@/lib/tenant";

export type ForgotState = { error?: string; done?: boolean };

const MAX_PER_IP = 5;
const MAX_PER_EMAIL = 3;

/** Always answers the same way, whether or not the email exists, so it can't be used to discover accounts. */
export async function requestReset(_p: ForgotState, fd: FormData): Promise<ForgotState> {
  const parsed = z.string().trim().toLowerCase().email().safeParse(fd.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const email = parsed.data;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const since = new Date(Date.now() - 3600_000);
  const [byIp, byEmail] = await asPlatform((tx) =>
    Promise.all([
      tx.auditLog.count({ where: { action: "reset.requested", detail: { endsWith: `|${ip}` }, createdAt: { gte: since } } }),
      tx.auditLog.count({ where: { action: "reset.requested", detail: { startsWith: `${email}|` }, createdAt: { gte: since } } }),
    ]),
  );
  if (byIp >= MAX_PER_IP || byEmail >= MAX_PER_EMAIL) return { error: "Too many requests. Please try again in an hour." };
  await auditPlatform(null, null, "reset.requested", undefined, undefined, `${email}|${ip}`);

  const user = await asPlatform((tx) => tx.user.findUnique({ where: { email }, include: { shop: { select: { name: true, isActive: true } } } }));
  if (user && user.isActive && (user.role === "PLATFORM_OWNER" || user.shop?.isActive)) {
    await issueLink(user.id, "RESET", user, user.shop?.name ?? "Duuka POS");
  }
  return { done: true };
}
