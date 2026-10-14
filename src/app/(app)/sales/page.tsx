import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Card, PageHeader, inputCls, td, tdNum, th } from "@/components/ui";
import { db } from "@/lib/db";
import { pageGuard } from "@/lib/guard";
import { formatNumber, formatUGX } from "@/lib/money";
import { can } from "@/lib/permissions";
import { addDays, formatDateTime, parseKampalaDate } from "@/lib/time";
import type { Prisma } from "@/generated/prisma/client";
import { PaymentMethod, SaleStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Sales" };
const PAGE_SIZE = 25;
const METHOD_LABEL: Record<string, string> = { CASH: "Cash", MOBILE_MONEY: "Mobile Money", CARD: "Card", BANK_TRANSFER: "Bank transfer" };

export default async function SalesPage({ searchParams }: PageProps<"/sales">) {
  const user = await pageGuard("sales.view");
  const viewAll = can(user.role, "sales.viewAll");
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = str("q").trim();
  const method = str("method") in PaymentMethod ? (str("method") as keyof typeof PaymentMethod) : undefined;
  const status = str("status") in SaleStatus ? (str("status") as keyof typeof SaleStatus) : undefined;
  const from = parseKampalaDate(str("from"));
  const to = parseKampalaDate(str("to"));
  const cashierId = viewAll ? str("cashier") : user.id; // cashiers only ever see their own sales
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.SaleWhereInput = {
    ...(cashierId && { cashierId }),
    ...(method && { paymentMethod: method }),
    ...(status && { status }),
    ...(q && { OR: [{ receiptNo: { contains: q, mode: "insensitive" } }, { customerName: { contains: q, mode: "insensitive" } }, { customerPhone: { contains: q } }, { items: { some: { productName: { contains: q, mode: "insensitive" } } } }] }),
    ...((from || to) && { createdAt: { ...(from && { gte: from }), ...(to && { lt: addDays(to, 1) }) } }),
  };

  const [sales, count, agg, cashiers] = await Promise.all([
    db.sale.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { cashier: { select: { name: true } }, _count: { select: { items: true } } } }),
    db.sale.count({ where }),
    db.sale.aggregate({ where, _sum: { total: true } }),
    viewAll ? db.user.findMany({ where: { role: { in: ["CASHIER", "MANAGER", "ADMIN"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const qs = (p: number) => new URLSearchParams(Object.entries({ q, method: method ?? "", status: status ?? "", from: str("from"), to: str("to"), cashier: cashierId && viewAll ? cashierId : "", page: String(p) }).filter(([, v]) => v)).toString();

  return (
    <>
      <PageHeader title="Sales" subtitle={`${formatNumber(count)} transaction${count === 1 ? "" : "s"} · ${formatUGX(agg._sum.total ?? 0)}`} />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <input name="q" defaultValue={q} placeholder="Receipt no., customer or product…" className={`${inputCls} max-w-xs`} />
        <input type="date" name="from" defaultValue={str("from")} className={`${inputCls} max-w-[10rem]`} aria-label="From date" />
        <input type="date" name="to" defaultValue={str("to")} className={`${inputCls} max-w-[10rem]`} aria-label="To date" />
        {viewAll && (
          <select name="cashier" defaultValue={cashierId} className={`${inputCls} max-w-[11rem]`}>
            <option value="">All cashiers</option>
            {cashiers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select name="method" defaultValue={method ?? ""} className={`${inputCls} max-w-[11rem]`}>
          <option value="">All payment methods</option>
          {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="status" defaultValue={status ?? ""} className={`${inputCls} max-w-[11rem]`}>
          <option value="">Any status</option>
          <option value="COMPLETED">Completed</option>
          <option value="PARTIALLY_REFUNDED">Partially refunded</option>
          <option value="REFUNDED">Refunded</option>
        </select>
        <Button type="submit" variant="secondary">Filter</Button>
        <Link href="/sales" className="px-2 py-2 text-sm text-slate-500 hover:underline">Reset</Link>
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr><th className={th}>Receipt</th><th className={th}>Date</th><th className={th}>Cashier</th><th className={`${th} text-right`}>Items</th><th className={th}>Payment</th><th className={`${th} text-right`}>Total</th><th className={th}>Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sales.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className={td}><Link href={`/sales/${s.id}`} className="font-medium text-brand-600 hover:underline">{s.receiptNo}</Link>{s.customerName && <div className="text-xs text-slate-500">{s.customerName}</div>}</td>
                <td className={`${td} whitespace-nowrap`}>{formatDateTime(s.createdAt)}</td>
                <td className={td}>{s.cashier.name}</td>
                <td className={tdNum}>{s._count.items}</td>
                <td className={td}>{METHOD_LABEL[s.paymentMethod]}</td>
                <td className={`${tdNum} font-medium`}>{formatUGX(s.total)}</td>
                <td className={td}>{s.status === "COMPLETED" ? <Badge tone="green">Completed</Badge> : s.status === "REFUNDED" ? <Badge tone="red">Refunded</Badge> : <Badge tone="amber">Part refunded</Badge>}</td>
              </tr>
            ))}
            {sales.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">No sales match your filters.</td></tr>}
          </tbody>
        </table>
      </Card>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={`/sales?${qs(page - 1)}`} className="rounded-lg border bg-white px-3 py-1.5 hover:bg-slate-50">Previous</Link>}
            {page < pages && <Link href={`/sales?${qs(page + 1)}`} className="rounded-lg border bg-white px-3 py-1.5 hover:bg-slate-50">Next</Link>}
          </div>
        </div>
      )}
    </>
  );
}
