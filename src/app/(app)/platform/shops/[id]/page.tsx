import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, td, th } from "@/components/ui";
import { platformGuard } from "@/lib/guard";
import { formatDate } from "@/lib/time";
import { asPlatform } from "@/lib/tenant";
import { PasswordReset, ShopDetailsForm, SuspendButton } from "./shop-controls";

export const metadata: Metadata = { title: "Manage shop" };

export default async function ShopPage({ params }: PageProps<"/platform/shops/[id]">) {
  await platformGuard();
  const { id } = await params;
  const shop = await asPlatform((tx) =>
    tx.shop.findUnique({
      where: { id },
      include: { users: { orderBy: [{ role: "asc" }, { name: "asc" }] }, _count: { select: { products: true, sales: true, categories: true } } },
    }),
  );
  if (!shop) notFound();
  return (
    <>
      <PageHeader title={shop.name} subtitle={`Created ${formatDate(shop.createdAt)} · ${shop._count.products} products · ${shop._count.sales} sales · ${shop._count.categories} categories`}
        actions={<SuspendButton id={shop.id} active={shop.isActive} />} />
      {!shop.isActive && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">This shop is suspended. None of its staff can sign in. Its data is kept.</div>}
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card className="h-fit p-5"><h2 className="mb-3 font-semibold">Shop details</h2><ShopDetailsForm id={shop.id} shop={{ name: shop.name, address: shop.address, phone: shop.phone }} /></Card>
        <Card className="overflow-x-auto">
          <h2 className="px-5 pt-5 font-semibold">People</h2>
          <table className="mt-2 w-full min-w-[560px]">
            <thead className="border-b border-slate-200 bg-slate-50"><tr><th className={th}>Name</th><th className={th}>Role</th><th className={th}>Status</th><th className={th}>Reset password</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {shop.users.map((u) => (
                <tr key={u.id}>
                  <td className={td}><div className="font-medium">{u.name}</div><div className="text-xs text-slate-500">{u.email}</div></td>
                  <td className={td}><Badge tone={u.role === "ADMIN" ? "blue" : u.role === "MANAGER" ? "amber" : "slate"}>{u.role.charAt(0) + u.role.slice(1).toLowerCase()}</Badge></td>
                  <td className={td}>{u.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
                  <td className={td}><PasswordReset userId={u.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
