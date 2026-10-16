import type { Prisma } from "@/generated/prisma/client";
import { addDays, kampalaDateString, parseKampalaDate, startOfKampalaDay } from "@/lib/time";
import type { Tx } from "@/lib/tenant";

// Expiry alerts: each product can carry the date its earliest-expiring stock runs out, and the shop chooses how many days
// ahead to be warned. Dates are Kampala calendar days; a product is usable through its expiry date and "expired" the day after.

export type ExpiryState = "none" | "ok" | "soon" | "expired";
export type ExpiryInfo = { state: ExpiryState; daysLeft?: number; label: string };

const dayNumber = (isoDate: string) => Math.round(Date.parse(`${isoDate}T00:00:00Z`) / 86_400_000);

export function expiryStatus(expiry: Date | string | number | null | undefined, alertDays: number, now = new Date()): ExpiryInfo {
  if (expiry === null || expiry === undefined || expiry === "") return { state: "none", label: "" };
  const left = dayNumber(kampalaDateString(new Date(expiry))) - dayNumber(kampalaDateString(now));
  if (left < 0) return { state: "expired", daysLeft: left, label: left === -1 ? "Expired yesterday" : `Expired ${-left} days ago` };
  const label = left === 0 ? "Expires today" : left === 1 ? "Expires tomorrow" : `Expires in ${left} days`;
  return { state: left <= alertDays ? "soon" : "ok", daysLeft: left, label };
}

/** An expiry date typed into a form (yyyy-mm-dd) as the start of that Kampala day; empty means "no expiry". */
export const parseExpiryInput = (s: string | null | undefined) => (s ? parseKampalaDate(s) : null);

/** Which products to look at. Only active products that are actually in stock matter: an empty shelf can't sell expired goods. */
export function expiryWhere(kind: "expired" | "soon", alertDays: number, now = new Date()): Prisma.ProductWhereInput {
  const today = startOfKampalaDay(now);
  return {
    isActive: true, stock: { gt: 0 },
    expiryDate: kind === "expired" ? { lt: today } : { gte: today, lt: addDays(today, alertDays + 1) },
  };
}

export async function expiryCounts(tx: Tx, alertDays: number, now = new Date()) {
  const [expired, soon, tracked] = await Promise.all([
    tx.product.count({ where: expiryWhere("expired", alertDays, now) }),
    tx.product.count({ where: expiryWhere("soon", alertDays, now) }),
    tx.product.count({ where: { isActive: true, expiryDate: { not: null } } }), // how many products use expiry dates at all
  ]);
  return { expired, soon, tracked };
}
