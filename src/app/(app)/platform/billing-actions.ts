"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { BillingError, createInvoice, markInvoicePaid, voidInvoice } from "@/lib/billing";
import { requirePlatformOwner } from "@/lib/session";
import { asPlatform } from "@/lib/tenant";
import { parseKampalaDate } from "@/lib/time";

export type BillingFormState = { error?: string; ok?: string };

const money = (label: string) => z.coerce.number({ message: `${label} must be a number` }).int(`${label}: whole numbers only`).min(0, `${label} can't be negative`).max(1_000_000_000);
const refresh = (shopId?: string) => { revalidatePath("/platform/billing"); if (shopId) revalidatePath(`/platform/shops/${shopId}`); };
const fail = (e: unknown): BillingFormState => {
  if (e instanceof BillingError) return { error: e.message };
  throw e;
};

/** Business details printed on invoices, and how shops should pay. */
export async function savePlatformSettings(_p: BillingFormState, fd: FormData): Promise<BillingFormState> {
  const owner = await requirePlatformOwner();
  const parsed = z.object({
    businessName: z.string().trim().max(100), address: z.string().trim().max(200), phone: z.string().trim().max(50), email: z.string().trim().max(100),
    paymentInstructions: z.string().trim().max(600), invoiceFooter: z.string().trim().max(300),
    trialDays: z.coerce.number().int().min(0).max(365),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await asPlatform(async (tx) => {
    await tx.platformSettings.upsert({ where: { id: "main" }, update: parsed.data, create: { id: "main", ...parsed.data } });
    await audit(tx, null, owner.id, "platform.settings", "PlatformSettings", "main");
  });
  refresh();
  return { ok: "Saved." };
}

export async function savePlan(shopId: string, _p: BillingFormState, fd: FormData): Promise<BillingFormState> {
  const owner = await requirePlatformOwner();
  const parsed = z.object({
    planName: z.string().trim().min(1, "Give the plan a name").max(40),
    monthlyPrice: money("Monthly price"),
    maxUsers: z.coerce.number().int().min(1, "At least 1 staff account").max(500),
    trialEndsAt: z.string().optional(), billingNote: z.string().trim().max(300).optional(),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const trial = d.trialEndsAt ? parseKampalaDate(d.trialEndsAt) : null;
  if (d.trialEndsAt && !trial) return { error: "Trial end date is not a valid date." };
  await asPlatform(async (tx) => {
    // Trial ends at the end of the chosen day.
    await tx.shop.update({ where: { id: shopId }, data: { planName: d.planName, monthlyPrice: d.monthlyPrice, maxUsers: d.maxUsers, billingNote: d.billingNote || null, trialEndsAt: trial ? new Date(trial.getTime() + 86_400_000 - 1) : null } });
    await audit(tx, shopId, owner.id, "billing.plan", "Shop", shopId, `${d.planName}, ${d.monthlyPrice}/month, ${d.maxUsers} staff`);
  });
  refresh(shopId);
  return { ok: "Plan saved." };
}

export async function issueInvoice(shopId: string, _p: BillingFormState, fd: FormData): Promise<BillingFormState> {
  const owner = await requirePlatformOwner();
  const parsed = z.object({
    months: z.coerce.number().int().min(1).max(24), amount: z.string().optional(), notes: z.string().trim().max(300).optional(),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Choose between 1 and 24 months." };
  const amount = parsed.data.amount ? money("Amount").safeParse(parsed.data.amount) : undefined;
  if (amount && !amount.success) return { error: amount.error.issues[0].message };
  try {
    await asPlatform(async (tx) => {
      const inv = await createInvoice(tx, shopId, { months: parsed.data.months, amount: amount?.data, notes: parsed.data.notes });
      await audit(tx, shopId, owner.id, "billing.invoice", "Invoice", inv.id, `${inv.number} ${inv.amount} ${inv.currency}`);
    });
  } catch (e) { return fail(e); }
  refresh(shopId);
  return { ok: "Invoice created." };
}

export async function recordPayment(invoiceId: string, shopId: string, _p: BillingFormState, fd: FormData): Promise<BillingFormState> {
  const owner = await requirePlatformOwner();
  const parsed = z.object({ method: z.string().trim().min(1, "Choose how it was paid").max(40), reference: z.string().trim().max(80).optional(), paidOn: z.string().optional() }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const paidAt = parsed.data.paidOn ? parseKampalaDate(parsed.data.paidOn) : null;
  if (parsed.data.paidOn && !paidAt) return { error: "Payment date is not a valid date." };
  try {
    await asPlatform(async (tx) => {
      const inv = await markInvoicePaid(tx, invoiceId, { method: parsed.data.method, reference: parsed.data.reference, paidAt: paidAt ?? undefined });
      await audit(tx, inv.shopId, owner.id, "billing.paid", "Invoice", inv.id, `${inv.number} via ${parsed.data.method}${parsed.data.reference ? ` (${parsed.data.reference})` : ""}`);
    });
  } catch (e) { return fail(e); }
  refresh(shopId);
  revalidatePath("/", "layout");
  return { ok: "Payment recorded." };
}

export async function cancelInvoice(invoiceId: string, shopId: string): Promise<BillingFormState> {
  const owner = await requirePlatformOwner();
  try {
    await asPlatform(async (tx) => {
      await voidInvoice(tx, invoiceId);
      await audit(tx, shopId, owner.id, "billing.void", "Invoice", invoiceId);
    });
  } catch (e) { return fail(e); }
  refresh(shopId);
  return { ok: "Invoice cancelled." };
}
