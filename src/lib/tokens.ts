import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { asPlatform } from "@/lib/tenant";
import { sendMail } from "@/lib/mail";

export type Purpose = "INVITE" | "RESET";
const TTL_MS: Record<Purpose, number> = { INVITE: 7 * 24 * 3600_000, RESET: 60 * 60_000 };

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

async function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}

/** Creates a one-time link (replacing any unused link of the same kind for that user) and emails it when possible. */
export async function issueLink(userId: string, purpose: Purpose, to: { email: string; name: string }, shopName: string) {
  const token = randomBytes(32).toString("base64url");
  await asPlatform(async (tx) => {
    await tx.authToken.deleteMany({ where: { userId, purpose, usedAt: null } });
    await tx.authToken.create({ data: { userId, purpose, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TTL_MS[purpose]) } });
  });
  const url = `${await baseUrl()}/set-password?token=${token}`;
  const invite = purpose === "INVITE";
  const { sent } = await sendMail(
    to.email,
    invite ? `You've been invited to ${shopName} on Duuka POS` : "Reset your Duuka POS password",
    invite
      ? `Hello ${to.name},\n\nYou've been added to ${shopName} on Duuka POS. Choose your password here (valid for 7 days):\n\n${url}\n`
      : `Hello ${to.name},\n\nUse this link to choose a new password (valid for 1 hour). If you didn't ask for this, ignore this email.\n\n${url}\n`,
  );
  return { url, sent };
}

/** Looks up a usable token without consuming it. */
export async function peekToken(token: string) {
  return asPlatform((tx) =>
    tx.authToken.findFirst({
      where: { tokenHash: hashToken(token), usedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { select: { id: true, name: true, email: true, isActive: true, shopId: true } } },
    }),
  );
}

/** Atomically spends a token and sets the password; returns the user, or null if the token was invalid, used or expired. */
export async function consumeToken(token: string, passwordHash: string) {
  return asPlatform(async (tx) => {
    const spent = await tx.authToken.updateMany({ where: { tokenHash: hashToken(token), usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (spent.count === 0) return null;
    const row = await tx.authToken.findUniqueOrThrow({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!row.user.isActive) return null;
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await tx.authToken.deleteMany({ where: { userId: row.userId } });
    return row.user;
  });
}
