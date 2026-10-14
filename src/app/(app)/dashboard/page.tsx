import type { Metadata } from "next";
import clsx from "clsx";
import Link from "next/link";
import { Badge, Card, PageHeader, StatTile, td, tdNum, th } from "@/components/ui";
import { BarList, TrendChart } from "@/components/charts";
import { bestSellers, groupByGrain, lowStockCounts, saleFacts, sumFacts, net } from "@/lib/analytics";
import { db } from "@/lib/db";
import { pageGuard } from "@/lib/guard";
import { formatNumber, formatUGX } from "@/lib/money";
import { addDays, startOfKampalaDay } from "@/lib/time";

export const metadata: Metadata = { title: "Dashboard" };
const RANGES = [{ days: 7, label: "Last 7 days" }, { days: 30, label: "Last 30 days" }, { days: 90, label: "Last 90 days" }];
const METHOD_LABEL: Record<string, string> = { CASH: "Cash", MOBILE_MONEY: "Mobile Money", CARD: "Card", BANK_TRANSFER: "Bank transfer" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  await pageGuard("dashboard.view");
  const sp = await searchParams;
  const days = RANGES.some((r) => r.days === Number(sp.range)) ? Number(sp.range) : 30;

  const today = startOfKampalaDay();
  const tomorrow = addDays(today, 1);
  const from = addDays(today, -(days - 1));

  const [facts, stock, top, lowRows] = await Promise.all([
    saleFacts(addDays(today, -Math.max(days - 1, 1)), tomorrow), // covers the range and yesterday
    lowStockCounts(),
    bestSellers(from, tomorrow, 8),
    db.$queryRaw<{ id: string; name: string; sku: string; stock: number; minStock: number }[]>`
      SELECT id, name, sku, stock, "minStock" FROM "Product" WHERE "isActive" = true AND stock <= "minStock" ORDER BY stock ASC, name ASC LIMIT 8`,
  ]);

  const inRange = facts.filter((f) => f.at >= from);
  const todayFacts = facts.filter((f) => f.at >= today);
  const yesterdayFacts = facts.filter((f) => f.at >= addDays(today, -1) && f.at < today);
  const t = sumFacts(todayFacts), y = sumFacts(yesterdayFacts), r = sumFacts(inRange);
  const pct = y.net > 0 ? ((t.net - y.net) / y.net) * 100 : null;

  const daily = groupByGrain(inRange, from, tomorrow, "day");
  const byMethod = Object.entries(METHOD_LABEL)
    .map(([k, label]) => ({ label, value: inRange.filter((f) => f.method === k).reduce((s, f) => s + net(f), 0), note: `${inRange.filter((f) => f.method === k).length} sales` }))
    .filter((m) => m.value > 0 || m.note !== "0 sales")
    .sort((a, b) => b.value - a.value);
  const rangeLabel = RANGES.find((x) => x.days === days)!.label.toLowerCase();

  return (
    <>
      <PageHeader title="Dashboard" subtitle="How the shop is doing" />

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Today</h2>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Today's sales" value={formatUGX(t.net)} delta={{ pct, vs: "yesterday" }} />
        <StatTile label="Transactions" value={formatNumber(t.transactions)} sub={t.transactions ? `Avg ${formatUGX(Math.round(t.net / t.transactions))}` : "No sales yet today"} />
        <StatTile label="Gross profit" value={formatUGX(t.profit)} sub={t.net > 0 ? `${((t.profit / t.net) * 100).toFixed(0)}% margin` : undefined} />
        <StatTile label="Low-stock products" value={String(stock.low + stock.out)} tone={stock.out ? "red" : stock.low ? "amber" : undefined} sub={`${stock.out} out of stock`} />
        <StatTile label="Total products" value={formatNumber(stock.total)} sub="Active products" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Period</span>
        {RANGES.map((x) => (
          <Link key={x.days} href={`/dashboard?range=${x.days}`} aria-current={x.days === days ? "true" : undefined}
            className={clsx("rounded-full border px-3 py-1 text-sm", x.days === days ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50")}>{x.label}</Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="min-w-0 xl:col-span-2">
          <TrendChart title="Sales over time" seriesName="Net sales"
            subtitle={`${formatUGX(r.net)} net sales · ${formatNumber(r.transactions)} transactions · ${formatUGX(r.profit)} gross profit (${rangeLabel})`}
            data={daily.map((d) => ({ label: d.key, value: d.net }))} />
        </div>
        <BarList title="Best-selling products" subtitle={`Units sold, ${rangeLabel}`} valueName="Units sold" unit="units"
          items={top.map((p) => ({ label: p.name, value: p.units, note: `${formatUGX(p.revenue)} revenue` }))} />
        <BarList title="Sales by payment method" subtitle={`Net sales, ${rangeLabel}`} valueName="Net sales" showShare items={byMethod} />
        <div className="min-w-0 xl:col-span-2">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div><h2 className="font-semibold">Needs restocking</h2><p className="text-sm text-slate-500">Products at or below their minimum level</p></div>
              <Link href="/inventory?filter=low" className="text-sm text-brand-600 hover:underline">View all</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead><tr><th className={th}>Product</th><th className={`${th} text-right`}>In stock</th><th className={`${th} text-right`}>Minimum</th><th className={th}>Status</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {lowRows.map((p) => (
                    <tr key={p.id}><td className={td}><span className="font-medium">{p.name}</span> <span className="text-xs text-slate-500">{p.sku}</span></td>
                      <td className={tdNum}>{p.stock}</td><td className={tdNum}>{p.minStock}</td>
                      <td className={td}>{p.stock === 0 ? <Badge tone="red">Out of stock</Badge> : <Badge tone="amber">Low stock</Badge>}</td></tr>
                  ))}
                  {lowRows.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">Everything is well stocked.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
