import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Card, PageHeader, inputCls, td, tdNum, th } from "@/components/ui";
import { db } from "@/lib/db";
import { pageGuard } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { formatDateTime, parseKampalaDate, addDays } from "@/lib/time";
import type { Prisma } from "@/generated/prisma/client";
import { StockMovementType } from "@/generated/prisma/enums";
import { InventoryTabs } from "../tabs";

export const metadata: Metadata = { title: "Stock history" };
const PAGE_SIZE = 30;
const LABELS: Record<string, string> = {
  INITIAL: "Opening stock", PURCHASE: "Purchase received", SALE: "Sale", RETURN: "Customer return",
  ADJUSTMENT_ADD: "Adjustment (+)", ADJUSTMENT_REMOVE: "Adjustment (−)", DAMAGE: "Damaged / expired",
};

export default async function HistoryPage({ searchParams }: PageProps<"/inventory/history">) {
  const user = await pageGuard("inventory.view");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const type = typeof sp.type === "string" && sp.type in StockMovementType ? (sp.type as keyof typeof StockMovementType) : "";
  const from = parseKampalaDate(typeof sp.from === "string" ? sp.from : null);
  const to = parseKampalaDate(typeof sp.to === "string" ? sp.to : null);
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.StockMovementWhereInput = {
    ...(q && { product: { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } }),
    ...(type && { type }),
    ...((from || to) && { createdAt: { ...(from && { gte: from }), ...(to && { lt: addDays(to, 1) }) } }),
  };
  const [rows, total] = await Promise.all([
    db.stockMovement.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { product: { select: { name: true, sku: true } }, user: { select: { name: true } } },
    }),
    db.stockMovement.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => new URLSearchParams({ ...(q && { q }), ...(type && { type }), ...(sp.from && { from: String(sp.from) }), ...(sp.to && { to: String(sp.to) }), page: String(p) }).toString();

  return (
    <>
      <PageHeader title="Inventory" subtitle="Complete log of every stock change" />
      <InventoryTabs active="history" canAdjust={can(user.role, "inventory.adjust")} />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <input name="q" defaultValue={q} placeholder="Product name or SKU…" className={`${inputCls} max-w-xs`} />
        <select name="type" defaultValue={type} className={`${inputCls} max-w-[13rem]`}>
          <option value="">All types</option>
          {Object.entries(LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" name="from" defaultValue={typeof sp.from === "string" ? sp.from : ""} className={`${inputCls} max-w-[10rem]`} aria-label="From date" />
        <input type="date" name="to" defaultValue={typeof sp.to === "string" ? sp.to : ""} className={`${inputCls} max-w-[10rem]`} aria-label="To date" />
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr><th className={th}>When</th><th className={th}>Product</th><th className={th}>Type</th><th className={`${th} text-right`}>Change</th><th className={`${th} text-right`}>Stock after</th><th className={th}>Reason / ref</th><th className={th}>By</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className={`${td} whitespace-nowrap`}>{formatDateTime(m.createdAt)}</td>
                <td className={td}><div className="font-medium">{m.product.name}</div><div className="text-xs text-slate-500">{m.product.sku}</div></td>
                <td className={td}><Badge tone={m.quantity > 0 ? "green" : "slate"}>{LABELS[m.type]}</Badge></td>
                <td className={`${tdNum} font-medium ${m.quantity > 0 ? "text-emerald-600" : "text-red-600"}`}>{m.quantity > 0 ? "+" : ""}{m.quantity}</td>
                <td className={tdNum}>{m.stockAfter}</td>
                <td className={td}>{m.reference ?? m.reason ?? "—"}</td>
                <td className={td}>{m.user?.name ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">No stock movements match.</td></tr>}
          </tbody>
        </table>
      </Card>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">Page {page} of {pages} · {total} movements</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={`/inventory/history?${qs(page - 1)}`} className="rounded-lg border bg-white px-3 py-1.5 hover:bg-slate-50">Previous</Link>}
            {page < pages && <Link href={`/inventory/history?${qs(page + 1)}`} className="rounded-lg border bg-white px-3 py-1.5 hover:bg-slate-50">Next</Link>}
          </div>
        </div>
      )}
    </>
  );
}
