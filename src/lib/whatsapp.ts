import { formatMoney } from "@/lib/money";
import type { ReceiptData } from "@/lib/printing/types";

const COUNTRY_CODE: Record<string, string> = { UGX: "256", KES: "254", TZS: "255", RWF: "250" };

/**
 * A phone number as WhatsApp wants it: digits only, with the country code and no leading 0 or +.
 * Local numbers (0772…, 772…) get the shop's country code; numbers already starting with a country code or 00/+ are kept.
 * Returns null when it can't be a real number.
 */
export function normalizePhone(raw: string | null | undefined, currency = "UGX"): string | null {
  if (!raw) return null;
  const cc = COUNTRY_CODE[currency] ?? "256";
  let d = raw.replace(/[^\d+]/g, "");
  const international = d.startsWith("+") || d.startsWith("00");
  d = d.replace(/^\+/, "").replace(/^00/, "").replace(/\D/g, "");
  if (!international) {
    if (d.startsWith("0")) d = cc + d.slice(1);
    else if (!d.startsWith(cc) && d.length <= 9) d = cc + d; // a local number typed without the leading 0
  }
  return d.length >= 10 && d.length <= 15 ? d : null;
}

/** The receipt as a WhatsApp message (*bold* is WhatsApp's own formatting). */
export function receiptToText(r: ReceiptData): string {
  const m = (n: number) => formatMoney(n, r.currency);
  const lines: string[] = [`*${r.shopName}*`];
  if (r.address) lines.push(r.address);
  if (r.phone) lines.push(r.phone);
  lines.push("", `Receipt: ${r.ref}`);
  if (r.refNote) lines.push(r.refNote);
  lines.push(`Date: ${r.dateText}`, `Served by: ${r.cashier}`, "");
  for (const it of r.lines) lines.push(`${it.quantity} × ${it.name} — ${m(it.lineTotal)}`);
  lines.push("", `Subtotal: ${m(r.subtotal)}`);
  if (r.discount > 0) lines.push(`Discount: -${m(r.discount)}`);
  lines.push(`*TOTAL: ${m(r.total)}*`, `Paid (${r.paymentLabel}): ${m(r.paid)}`);
  if (r.change > 0) lines.push(`Change: ${m(r.change)}`);
  if (r.reference) lines.push(`Ref: ${r.reference}`);
  if (r.refunded) lines.push(`Refunded: -${m(r.refunded)}`);
  if (r.status) lines.push(r.status);
  if (r.footer) lines.push("", r.footer);
  return lines.join("\n");
}

/** Opens WhatsApp with the message ready to send. With no number, WhatsApp asks who to send it to. */
export const whatsappLink = (phone: string | null, text: string) => `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`;
