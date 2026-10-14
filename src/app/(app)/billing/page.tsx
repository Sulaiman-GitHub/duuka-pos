import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader, td, th } from "@/components/ui";
import { billingStatus } from "@/lib/billing";
import { pageGuard } from "@/lib/guard";
import { invoiceFrom } from "@/lib/invoice-data";
import { formatMoney } from "@/lib/money";
import { withShop } from "@/lib/tenant";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const user = await pageGuard("billing.view");
  const [shop, invoices, from] = await Promise.all([
    withShop(user.shopId, (db) => db.shop.findUniqueOrThrow({ where: { id: user.shopId } })),
    withShop(user.shopId, (db) => db.invoice.findMany({ where: { status: { not: "VOID" } }, orderBy: { issuedAt: "desc" }, take: 50 })),
    invoiceFrom(),
  ]);
  const info = billingStatus(shop);
  const unpaid = invoices.filter((i) => i.status === "UNPAID");
  return (
    <>
      <PageHeader title="Billing" subtitle="Your Duuka POS subscription" />
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{shop.planName} plan</h2><Badge tone={info.tone}>{info.label}</Badge></div>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Price</dt><dd>{shop.monthlyPrice > 0 ? `${formatMoney(shop.monthlyPrice, shop.currency)} / month` : "Free"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Staff accounts</dt><dd>up to {shop.maxUsers}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">{shop.paidUntil ? "Covered until" : "Trial ends"}</dt><dd>{shop.paidUntil ? formatDate(shop.paidUntil) : shop.trialEndsAt ? formatDate(shop.trialEndsAt) : "—"}</dd></div>
          </dl>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold">How to pay</h2>
          {from.paymentInstructions ? <p className="mt-2 whitespace-pre-line text-sm">{from.paymentInstructions}</p> : <p className="mt-2 text-sm text-slate-500">Contact us to arrange payment.</p>}
          {(from.phone || from.email) && <p className="mt-3 text-xs text-slate-500">Questions? {[from.phone, from.email].filter(Boolean).join(" · ")}</p>}
          {unpaid.length > 0 && <p className="mt-3 text-sm font-medium text-amber-800">Please quote the invoice number when you pay. After payment, we record it and your cover is extended.</p>}
        </Card>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-slate-200 bg-slate-50"><tr><th className={th}>Invoice</th><th className={th}>Period</th><th className={`${th} text-right`}>Amount</th><th className={th}>Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((i) => (
              <tr key={i.id}>
                <td className={td}><Link href={`/billing/${i.id}`} className="font-medium text-brand-600 hover:underline">{i.number}</Link></td>
                <td className={`${td} whitespace-nowrap`}>{formatDate(i.periodStart)} – {formatDate(i.periodEnd)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMoney(i.amount, i.currency)}</td>
                <td className={td}>{i.status === "PAID" ? <Badge tone="green">Paid {i.paidAt ? formatDate(i.paidAt) : ""}</Badge> : <Badge tone="amber">Due {formatDate(i.dueDate)}</Badge>}</td>
              </tr>
            ))}
            {invoices.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">No invoices yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
