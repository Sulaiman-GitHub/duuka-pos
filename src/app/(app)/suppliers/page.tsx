import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader, td, th } from "@/components/ui";
import { db } from "@/lib/db";
import { pageGuard } from "@/lib/guard";
import { formatUGX } from "@/lib/money";
import { SupplierTabs } from "./tabs";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  await pageGuard("suppliers.manage");
  const suppliers = await db.supplier.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }], include: { _count: { select: { purchaseOrders: true } }, purchaseOrders: { where: { status: { not: "CANCELLED" } }, select: { total: true } } } });
  return (
    <>
      <PageHeader title="Suppliers & Orders" subtitle="Who you buy from, and what you've ordered"
        actions={<Link href="/suppliers/new" className="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">+ New supplier</Link>} />
      <SupplierTabs active="suppliers" />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="border-b border-slate-200 bg-slate-50"><tr><th className={th}>Supplier</th><th className={th}>Contact</th><th className={`${th} text-right`}>Orders</th><th className={`${th} text-right`}>Total ordered</th><th className={th}>Status</th><th className={th} /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {suppliers.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className={td}><div className="font-medium">{s.name}</div><div className="text-xs text-slate-500">{s.address}</div></td>
                <td className={td}><div>{s.phone ?? "—"}</div><div className="text-xs text-slate-500">{s.email}</div></td>
                <td className={`${td} text-right tabular-nums`}>{s._count.purchaseOrders}</td>
                <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{formatUGX(s.purchaseOrders.reduce((t, o) => t + o.total, 0))}</td>
                <td className={td}>{s.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
                <td className={`${td} text-right`}><Link href={`/suppliers/${s.id}/edit`} className="text-brand-500 hover:underline">Edit</Link></td>
              </tr>
            ))}
            {suppliers.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">No suppliers yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
