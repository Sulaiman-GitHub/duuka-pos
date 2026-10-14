import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, td, th } from "@/components/ui";
import { platformGuard } from "@/lib/guard";
import Link from "next/link";
import { billingStatus } from "@/lib/billing";
import { formatMoney } from "@/lib/money";
import { formatDate, kampalaDateString } from "@/lib/time";
import { asPlatform } from "@/lib/tenant";
import { InvoiceActions, NewInvoiceForm, PlanForm } from "./billing-controls";
import { PasswordReset, ShopDetailsForm, SuspendButton } from "./shop-controls";

export const metadata: Metadata = { title: "Manage shop" };

export default async function ShopPage({ params }: PageProps<"/platform/shops/[id]">) {
  await platformGuard();
  const { id } = await params;
  const shop = await asPlatform((tx) =>
    tx.shop.findUnique({
      where: { id },
      include: {
        users: { orderBy: [{ role: "asc" }, { name: "asc" }] }, _count: { select: { products: true, sales: true, categories: true } },
        invoices: { orderBy: { issuedAt: "desc" }, take: 50 },
      },
    }),
  );
  if (!shop) notFound();
  const info = billingStatus(shop);
  const today = kampalaDateString();
  return (
    <>
      <PageHeader title={shop.name} subtitle={`Created ${formatDate(shop.createdAt)} · ${shop._count.products} products · ${shop._count.sales} sales · ${shop._count.categories} categories`}
        actions={<SuspendButton id={shop.id} active={shop.isActive} />} />
      {!shop.isActive && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">This shop is suspended. None of its staff can sign in. Its data is kept.</div>}
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card className="h-fit p-5"><h2 className="mb-3 font-semibold">Shop details</h2><ShopDetailsForm id={shop.id} shop={{ name: shop.name, address: shop.address, phone: shop.phone, currency: shop.currency }} /></Card>
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

      <h2 id="billing" className="mb-2 mt-8 scroll-mt-4 text-lg font-semibold">Billing</h2>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2"><h3 className="font-semibold">Plan</h3><Badge tone={info.tone}>{info.label}</Badge>{shop.paidUntil && <span className="text-xs text-slate-500">covered until {formatDate(shop.paidUntil)}</span>}</div>
          <PlanForm shopId={shop.id} currency={shop.currency}
            plan={{ planName: shop.planName, monthlyPrice: shop.monthlyPrice, maxUsers: shop.maxUsers, trialEndsAt: shop.trialEndsAt ? kampalaDateString(shop.trialEndsAt) : "", billingNote: shop.billingNote ?? "" }} />
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">New invoice</h3>
          <NewInvoiceForm shopId={shop.id} monthlyPrice={shop.monthlyPrice} currency={shop.currency} />
          <p className="mt-3 text-xs text-slate-500">The invoice covers the next period not yet billed. Recording its payment extends the shop&apos;s cover automatically.</p>
        </Card>
      </div>
      <Card className="mt-4 overflow-x-auto">
        <h3 className="px-5 pt-5 font-semibold">Invoices</h3>
        <table className="mt-2 w-full min-w-[760px]">
          <thead className="border-b border-slate-200 bg-slate-50"><tr><th className={th}>Number</th><th className={th}>Period</th><th className={`${th} text-right`}>Amount</th><th className={th}>Status</th><th className={th}>Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {shop.invoices.map((i) => (
              <tr key={i.id} className="align-top">
                <td className={td}><Link href={`/platform/invoices/${i.id}`} className="font-medium text-brand-600 hover:underline">{i.number}</Link><div className="text-xs text-slate-500">issued {formatDate(i.issuedAt)}</div></td>
                <td className={`${td} whitespace-nowrap`}>{formatDate(i.periodStart)} – {formatDate(i.periodEnd)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMoney(i.amount, i.currency)}</td>
                <td className={td}>{i.status === "PAID" ? <><Badge tone="green">Paid</Badge><div className="mt-1 text-xs text-slate-500">{i.paymentMethod}{i.paymentReference ? ` · ${i.paymentReference}` : ""}{i.paidAt ? ` · ${formatDate(i.paidAt)}` : ""}</div></> : i.status === "VOID" ? <Badge>Cancelled</Badge> : <><Badge tone="amber">Unpaid</Badge><div className="mt-1 text-xs text-slate-500">due {formatDate(i.dueDate)}</div></>}</td>
                <td className={td}>{i.status === "UNPAID" ? <InvoiceActions invoiceId={i.id} shopId={shop.id} today={today} /> : <Link href={`/platform/invoices/${i.id}`} className="text-sm text-slate-500 hover:underline">View / print</Link>}</td>
              </tr>
            ))}
            {shop.invoices.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No invoices yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}