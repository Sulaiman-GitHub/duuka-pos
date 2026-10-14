import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader, td, tdNum, th } from "@/components/ui";
import { platformGuard } from "@/lib/guard";
import { formatDate } from "@/lib/time";
import { asPlatform } from "@/lib/tenant";

export const metadata: Metadata = { title: "Shops" };

export default async function PlatformPage() {
  await platformGuard();
  const shops = await asPlatform((tx) =>
    tx.shop.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true, products: true, sales: true } }, users: { where: { role: "ADMIN" }, select: { name: true, email: true, isActive: true }, orderBy: { createdAt: "asc" } } },
    }),
  );
  return (
    <>
      <PageHeader title="Shops" subtitle={`${shops.length} shop${shops.length === 1 ? "" : "s"} on the platform`}
        actions={<Link href="/platform/shops/new" className="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">+ New shop</Link>} />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead className="border-b border-slate-200 bg-slate-50"><tr><th className={th}>Shop</th><th className={th}>Admin</th><th className={`${th} text-right`}>Staff</th><th className={`${th} text-right`}>Products</th><th className={`${th} text-right`}>Sales</th><th className={th}>Created</th><th className={th}>Status</th><th className={th} /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {shops.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className={td}><div className="font-medium">{s.name}</div><div className="text-xs text-slate-500">{s.address}</div></td>
                <td className={td}>{s.users[0] ? <><div>{s.users[0].name}</div><div className="text-xs text-slate-500">{s.users[0].email}</div></> : "—"}</td>
                <td className={tdNum}>{s._count.users}</td><td className={tdNum}>{s._count.products}</td><td className={tdNum}>{s._count.sales}</td>
                <td className={`${td} whitespace-nowrap`}>{formatDate(s.createdAt)}</td>
                <td className={td}>{s.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Suspended</Badge>}</td>
                <td className={`${td} text-right`}><Link href={`/platform/shops/${s.id}`} className="text-brand-500 hover:underline">Manage</Link></td>
              </tr>
            ))}
            {shops.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">No shops yet. Create the first one.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
