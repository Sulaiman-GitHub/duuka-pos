import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader, td, tdNum, th } from "@/components/ui";
import { platformGuard } from "@/lib/guard";
import { formatDate } from "@/lib/time";
import { asPlatform } from "@/lib/tenant";

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600_000);

export const metadata: Metadata = { title: "Shops" };

export default async function PlatformPage() {
  await platformGuard();
  const since = daysAgo(30);
  const [shops, lastSales, recent] = await asPlatform((tx) => Promise.all([
    tx.shop.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true, products: true, sales: true } }, users: { where: { role: "ADMIN" }, select: { name: true, email: true, isActive: true }, orderBy: { createdAt: "asc" } } },
    }),
    tx.sale.groupBy({ by: ["shopId"], _max: { createdAt: true } }),
    tx.sale.groupBy({ by: ["shopId"], where: { createdAt: { gte: since } }, _count: true }),
  ]));
  const last = new Map(lastSales.map((r) => [r.shopId, r._max.createdAt]));
  const salesLast30 = recent.reduce((t, r) => t + r._count, 0);
  const activeShops = shops.filter((s) => s.isActive).length;
  const activeSelling = recent.length;
  return (
    <>
      <PageHeader title="Shops" subtitle={`${shops.length} shop${shops.length === 1 ? "" : "s"} on the platform`}
        actions={<Link href="/platform/shops/new" className="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">+ New shop</Link>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {[["Active shops", activeShops], ["Suspended", shops.length - activeShops], ["Shops selling (30 days)", activeSelling], ["Sales (30 days)", salesLast30]].map(([l, v]) => (
          <Card key={l} className="p-4"><div className="text-xs font-medium uppercase tracking-wide text-slate-500">{l}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{v}</div></Card>
        ))}
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="border-b border-slate-200 bg-slate-50"><tr><th className={th}>Shop</th><th className={th}>Admin</th><th className={`${th} text-right`}>Staff</th><th className={`${th} text-right`}>Products</th><th className={`${th} text-right`}>Sales</th><th className={th}>Last sale</th><th className={th}>Created</th><th className={th}>Status</th><th className={th} /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {shops.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className={td}><div className="font-medium">{s.name}</div><div className="text-xs text-slate-500">{s.currency}{s.address ? ` · ${s.address}` : ""}</div></td>
                <td className={td}>{s.users[0] ? <><div>{s.users[0].name}</div><div className="text-xs text-slate-500">{s.users[0].email}</div></> : "—"}</td>
                <td className={tdNum}>{s._count.users}</td><td className={tdNum}>{s._count.products}</td><td className={tdNum}>{s._count.sales}</td>
                <td className={`${td} whitespace-nowrap`}>{last.get(s.id) ? formatDate(last.get(s.id)!) : "—"}</td>
                <td className={`${td} whitespace-nowrap`}>{formatDate(s.createdAt)}</td>
                <td className={td}>{s.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Suspended</Badge>}</td>
                <td className={`${td} text-right`}><Link href={`/platform/shops/${s.id}`} className="text-brand-500 hover:underline">Manage</Link></td>
              </tr>
            ))}
            {shops.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">No shops yet. Create the first one.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
