import { addDays, kampalaDateString, startOfKampalaDay } from "@/lib/time";
import type { Tx } from "@/lib/tenant";

// Manual subscription billing: the platform owner agrees a plan with a shop, issues invoices, and records payments as
// they arrive (Mobile Money, bank, cash). A shop is "covered" until `paidUntil`. Nothing here talks to a payment provider.

const DAY = 86_400_000;
export const DUE_SOON_DAYS = 5;

export class BillingError extends Error {}
export class PlanLimitError extends Error {}

export type BillingTone = "green" | "amber" | "red" | "slate" | "blue";
export type BillingState = "free" | "trial" | "paid" | "due_soon" | "overdue" | "trial_ended";
export type BillingInfo = { state: BillingState; label: string; tone: BillingTone; daysLeft?: number; daysOverdue?: number; until?: Date };

type ShopBilling = { monthlyPrice: number; trialEndsAt: Date | null; paidUntil: Date | null };

const daysBetween = (a: Date, b: Date) => Math.ceil((a.getTime() - b.getTime()) / DAY);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Where a shop stands right now. Pure, so it can be shown anywhere and tested. */
export function billingStatus(shop: ShopBilling, now = new Date()): BillingInfo {
  if (shop.paidUntil && shop.paidUntil >= now) {
    const left = daysBetween(shop.paidUntil, now);
    return left <= DUE_SOON_DAYS
      ? { state: "due_soon", label: `Renewal due in ${plural(left, "day")}`, tone: "amber", daysLeft: left, until: shop.paidUntil }
      : { state: "paid", label: "Paid", tone: "green", daysLeft: left, until: shop.paidUntil };
  }
  if (shop.paidUntil) {
    const over = Math.max(1, daysBetween(now, shop.paidUntil));
    return { state: "overdue", label: `Overdue by ${plural(over, "day")}`, tone: "red", daysOverdue: over, until: shop.paidUntil };
  }
  if (shop.trialEndsAt) {
    if (shop.trialEndsAt >= now) {
      const left = daysBetween(shop.trialEndsAt, now);
      return { state: left <= DUE_SOON_DAYS ? "due_soon" : "trial", label: `Trial: ${plural(left, "day")} left`, tone: left <= DUE_SOON_DAYS ? "amber" : "blue", daysLeft: left, until: shop.trialEndsAt };
    }
    const over = Math.max(1, daysBetween(now, shop.trialEndsAt));
    return { state: "trial_ended", label: `Trial ended ${plural(over, "day")} ago`, tone: "red", daysOverdue: over, until: shop.trialEndsAt };
  }
  return { state: "free", label: shop.monthlyPrice > 0 ? "Not yet invoiced" : "Free", tone: "slate" };
}

/** Whether to nag the shop's administrators. */
export const needsAttention = (i: BillingInfo) => i.state === "due_soon" || i.state === "overdue" || i.state === "trial_ended";

/** `date` plus whole calendar months, in Kampala time. */
export function addMonthsKampala(date: Date, months: number) {
  const [y, m, d] = kampalaDateString(date).split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return new Date(`${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(Math.min(d, lastDay))}T00:00:00.000+03:00`);
}

export const getPlatformSettings = (tx: Tx) => tx.platformSettings.upsert({ where: { id: "main" }, update: {}, create: { id: "main" } });

export type NewInvoice = { months: number; amount?: number; dueInDays?: number; description?: string; notes?: string };

/**
 * Issues an invoice for the next unbilled period of a shop. The period starts the day after whatever is already
 * covered or invoiced, so two invoices can never bill the same days. Platform level only.
 */
export async function createInvoice(tx: Tx, shopId: string, input: NewInvoice, now = new Date()) {
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > 24) throw new BillingError("Choose between 1 and 24 months.");
  const shop = await tx.shop.findUnique({ where: { id: shopId } });
  if (!shop) throw new BillingError("Shop not found.");
  const amount = input.amount ?? shop.monthlyPrice * input.months;
  if (!Number.isInteger(amount) || amount < 0) throw new BillingError("The amount must be a whole number of zero or more.");
  if (amount === 0) throw new BillingError("Set a monthly price for this shop first (or enter an amount).");

  const unpaid = await tx.invoice.aggregate({ where: { shopId, status: "UNPAID" }, _max: { periodEnd: true } });
  // Days already covered: paid cover, a running free trial, or an earlier unpaid invoice. Billing starts after all of them.
  const trial = shop.trialEndsAt && shop.trialEndsAt > now ? shop.trialEndsAt : null;
  const coveredThrough = [shop.paidUntil, unpaid._max.periodEnd, trial].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0];
  const today = startOfKampalaDay(now);
  const nextDay = coveredThrough ? startOfKampalaDay(addDays(coveredThrough, 0.5)) : undefined; // first day after the covered period
  const periodStart = nextDay && nextDay > today ? nextDay : today;
  const periodEnd = new Date(addMonthsKampala(periodStart, input.months).getTime() - 1);

  const s = await tx.platformSettings.upsert({ where: { id: "main" }, update: { nextInvoiceNo: { increment: 1 } }, create: { id: "main", nextInvoiceNo: 2 } });
  const seq = s.nextInvoiceNo - 1; // the increment takes a row lock, so concurrent invoices get different numbers
  const number = `INV-${kampalaDateString(now).slice(0, 4)}-${String(seq).padStart(4, "0")}`;

  return tx.invoice.create({
    data: {
      shopId, number, amount, currency: shop.currency, periodStart, periodEnd,
      description: input.description?.trim() || `${shop.planName} plan: ${input.months} month${input.months === 1 ? "" : "s"}`,
      dueDate: addDays(today, input.dueInDays ?? 7), notes: input.notes?.trim() || null,
    },
  });
}

/** Records that an invoice was paid and extends the shop's cover to the end of that invoice's period. */
export async function markInvoicePaid(tx: Tx, invoiceId: string, pay: { method: string; reference?: string; paidAt?: Date }) {
  // Only an UNPAID invoice can be paid, and the conditional update makes a double click or two admins at once harmless.
  const r = await tx.invoice.updateMany({
    where: { id: invoiceId, status: "UNPAID" },
    data: { status: "PAID", paidAt: pay.paidAt ?? new Date(), paymentMethod: pay.method, paymentReference: pay.reference || null },
  });
  if (r.count === 0) throw new BillingError("That invoice is already paid or cancelled.");
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const shop = await tx.shop.findUniqueOrThrow({ where: { id: inv.shopId }, select: { paidUntil: true } });
  const paidUntil = shop.paidUntil && shop.paidUntil > inv.periodEnd ? shop.paidUntil : inv.periodEnd;
  await tx.shop.update({ where: { id: inv.shopId }, data: { paidUntil } });
  return inv;
}

/** Cancels an unpaid invoice. (A paid invoice stays on record.) */
export async function voidInvoice(tx: Tx, invoiceId: string) {
  const r = await tx.invoice.updateMany({ where: { id: invoiceId, status: "UNPAID" }, data: { status: "VOID" } });
  if (r.count === 0) throw new BillingError("Only an unpaid invoice can be cancelled.");
}

/** Enforces the plan's staff limit. Runs in the shop's own context. */
export async function assertCanAddUser(tx: Tx, shopId: string) {
  const [shop, active] = await Promise.all([
    tx.shop.findUniqueOrThrow({ where: { id: shopId }, select: { maxUsers: true, planName: true } }),
    tx.user.count({ where: { isActive: true } }),
  ]);
  if (active >= shop.maxUsers) throw new PlanLimitError(`Your ${shop.planName} plan allows ${shop.maxUsers} active staff accounts. Deactivate someone, or contact us to upgrade.`);
}
