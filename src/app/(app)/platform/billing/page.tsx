import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader, td, tdNum, th } from "@/components/ui";
import { billingStatus } from "@/lib/billing";
import { platformGuard } from "@/lib/guard";
import { formatMoney } from "@/lib/money";
import { asPlatform } from "@/lib/tenant";
import { formatDate } from "@/lib/time";
import { getPlatformSettings } from "@/lib/billing";
import { PlatformSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Billing" };

const RANK = { overdue: 0, trial_ended: 0, due_soon: 1, trial: 2, paid: 3, free: 4 } as const;

export default async function PlatformBillingPage() {
  await platformGuard();
  const [shops, unpaid, settings] = await asPlatform((tx) => Promise.all([
    tx.shop.findMany({ select: { id: true, name: true, planName: true, monthlyPrice: true, currency: true, trialEndsAt: true, paidUntil: true, isActive: true } }),
    tx.invoice.groupBy({ by: ["shopId", "currency"], where: { status: "UNPAID" }, _sum: { amount: true }, _count: true }),
    getPlatformSettings(tx),
  ]));
  const now = new Date();
  const rows = shops.map((s) => ({ ...s, info: billingStatus(s, now), owed: unpaid.find((u) => u.shopId === s.id) })).sort((a, b) => RANK[a.info.state] - RANK[b.info.state] || a.name.localeCompare(b.name));

  // Totals per currency, since shops may bill in different ones.
  const sum = (pick: (r: (typeof rows)[number]) => number, filter: (r: (typeof rows)[number]) => boolean) => {
    const m = new Map<string, number>();
    for (const r of rows) if (filter(r)) m.set(r.currency, (m.get(r.currency) ?? 0) + pick(r));
    return [...m.entries()].map(([c, n]) => formatMoney(n, c)).join(" · ") || "—";
  };
  const recurring = sum((r) => r.monthlyPrice, (r) => ["paid", "due_soon", "overdue"].includes(r.info.state));
  const owed = new Map<string, number>();
  for (const u of unpaid) owed.set(u.currency, (owed.get(u.currency) ?? 0) + (u._sum.amount ?? 0));
  const outstanding = [...owed.entries()].map(([c, n]) => formatMoney(n, c)).join(" · ") || "—";
  const attention = rows.filter((r) => ["overdue", "trial_ended"].includes(r.info.state)).length;

  return (
    <>
      <PageHeader title="Billing" subtitle="Plans, invoices and payments. You issue invoices and record payments by hand." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[["Monthly recurring (paying shops)", recurring], ["Unpaid invoices", outstanding], ["Shops needing attention", String(attention)]].map(([l, v]) => (
          <Card key={l} className="p-4"><div className="text-xs font-medium uppercase tracking-wide text-slate-500">{l}</div><div className="mt-1 text-xl font-semibold tabular-nums">{v}</div></Card>
        ))}
      </div>
      <Card className="mb-6 overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead className="border-b border-slate-200 bg-slate-50"><tr><th className={th}>Shop</th><th className={th}>Plan</th><th className={`${th} text-right`}>Price / month</th><th className={th}>Status</th><th className={th}>Covered until</th><th className={`${th} text-right`}>Unpaid</th><th className={th} /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className={td}><div className="font-medium">{r.name}</div>{!r.isActive && <Badge tone="red">Suspended</Badge>}</td>
                <td className={td}>{r.planName}</td>
                <td className={tdNum}>{r.monthlyPrice > 0 ? formatMoney(r.monthlyPrice, r.currency) : "—"}</td>
                <td className={td}><Badge tone={r.info.tone}>{r.info.label}</Badge></td>
                <td className={`${td} whitespace-nowrap`}>{r.paidUntil ? formatDate(r.paidUntil) : r.trialEndsAt ? `${formatDate(r.trialEndsAt)} (trial)` : "—"}</td>
                <td className={tdNum}>{r.owed ? `${formatMoney(r.owed._sum.amount ?? 0, r.currency)} (${r.owed._count})` : "—"}</td>
                <td className={`${td} text-right`}><Link href={`/platform/shops/${r.id}#billing`} className="text-brand-500 hover:underline">Manage</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">No shops yet.</td></tr>}
          </tbody>
        </table>
      </Card>
      <h2 className="mb-2 font-semibold">Your business details</h2>
      <Card className="p-5"><PlatformSettingsForm settings={settings} /></Card>
    </>
  );
}
