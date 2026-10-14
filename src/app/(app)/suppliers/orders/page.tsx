import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader, td, th } from "@/components/ui";
import { db } from "@/lib/db";
import { pageGuard } from "@/lib/guard";
import { formatUGX } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { STATUS_TONE } from "../status";
import { SupplierTabs } from "../tabs";

export const metadata: Metadata = { title: "Purchase orders" };

export default async function OrdersPage() {
  await pageGuard("suppliers.manage");
  const orders = await db.purchaseOrder.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { supplier: { select: { name: true } }, items: { select: { quantity: true, receivedQty: true } } } });
  return (
    <>
      <PageHeader title="Suppliers & Orders" subtitle="Order stock from suppliers and receive it into inventory"
        actions={<Link href="/suppliers/orders/new" className="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">+ New purchase order</Link>} />
      <SupplierTabs active="orders" />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-slate-200 bg-slate-50"><tr><th className={th}>Order</th><th className={th}>Supplier</th><th className={th}>Date</th><th className={`${th} text-right`}>Received</th><th className={`${th} text-right`}>Total</th><th className={th}>Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((o) => {
              const ordered = o.items.reduce((s, i) => s + i.quantity, 0), got = o.items.reduce((s, i) => s + i.receivedQty, 0);
              return (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className={td}><Link href={`/suppliers/orders/${o.id}`} className="font-medium text-brand-600 hover:underline">{o.poNumber}</Link></td>
                  <td className={td}>{o.supplier.name}</td>
                  <td className={`${td} whitespace-nowrap`}>{formatDate(o.createdAt)}</td>
                  <td className={`${td} text-right tabular-nums`}>{got} / {ordered}</td>
                  <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{formatUGX(o.total)}</td>
                  <td className={td}><Badge tone={STATUS_TONE[o.status]}>{o.status.charAt(0) + o.status.slice(1).toLowerCase()}</Badge></td>
                </tr>
              );
            })}
            {orders.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">No purchase orders yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
