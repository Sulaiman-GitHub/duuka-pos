import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { pageGuard } from "@/lib/guard";
import { formatUGX } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/time";
import { STATUS_TONE } from "../../status";
import { OrderActions } from "./order-actions";
import { ReceiveForm } from "./receive-form";

export const metadata: Metadata = { title: "Purchase order" };

export default async function OrderPage({ params }: PageProps<"/suppliers/orders/[id]">) {
  await pageGuard("suppliers.manage");
  const { id } = await params;
  const business = await getSettings();
  const po = await db.purchaseOrder.findUnique({ where: { id }, include: { supplier: true, createdBy: { select: { name: true } }, items: { include: { product: { select: { name: true, sku: true } } }, orderBy: { product: { name: "asc" } } } } });
  if (!po) notFound();
  const canReceive = po.status === "ORDERED" && po.items.some((i) => i.receivedQty < i.quantity);
  const canCancel = (po.status === "DRAFT" || po.status === "ORDERED") && po.items.every((i) => i.receivedQty === 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4"><Link href="/suppliers/orders" className="text-sm text-slate-500 hover:underline">← All purchase orders</Link></div>
      <Card className="mb-4 p-6 print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="hidden text-xs text-slate-500 print:block">{business.name} · {business.address} · {business.phone}</div>
            <h1 className="text-2xl font-semibold">{po.poNumber} <Badge tone={STATUS_TONE[po.status]}>{po.status.charAt(0) + po.status.slice(1).toLowerCase()}</Badge></h1>
            <p className="mt-1 text-sm text-slate-500">Created {formatDateTime(po.createdAt)} by {po.createdBy.name}{po.receivedAt && ` · Fully received ${formatDate(po.receivedAt)}`}</p>
          </div>
          <OrderActions id={po.id} status={po.status} canCancel={canCancel} />
        </div>
        <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Supplier</div><div className="font-medium">{po.supplier.name}</div><div className="text-slate-600">{[po.supplier.phone, po.supplier.email, po.supplier.address].filter(Boolean).join(" · ")}</div></div>
          <div>{po.invoiceNo && <><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Supplier invoice</div><div className="font-medium">{po.invoiceNo}</div></>}{po.note && <div className="mt-2 text-slate-600">{po.note}</div>}</div>
        </div>
        <table className="mt-5 w-full text-sm">
          <thead className="border-b border-slate-200"><tr><th className="py-2 text-left text-xs font-semibold uppercase text-slate-500">Product</th><th className="py-2 text-right text-xs font-semibold uppercase text-slate-500">Ordered</th><th className="py-2 text-right text-xs font-semibold uppercase text-slate-500">Received</th><th className="py-2 text-right text-xs font-semibold uppercase text-slate-500">Unit cost</th><th className="py-2 text-right text-xs font-semibold uppercase text-slate-500">Total</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {po.items.map((i) => (
              <tr key={i.id}><td className="py-2"><div className="font-medium">{i.product.name}</div><div className="text-xs text-slate-500">{i.product.sku}</div></td>
                <td className="py-2 text-right tabular-nums">{i.quantity}</td><td className="py-2 text-right tabular-nums">{i.receivedQty}</td>
                <td className="py-2 text-right tabular-nums">{formatUGX(i.unitCost)}</td><td className="py-2 text-right tabular-nums">{formatUGX(i.quantity * i.unitCost)}</td></tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t-2 border-slate-300 font-semibold"><td colSpan={4} className="py-2 text-right">Total</td><td className="py-2 text-right tabular-nums">{formatUGX(po.total)}</td></tr></tfoot>
        </table>
      </Card>
      {canReceive && (
        <Card className="no-print p-6">
          <h2 className="mb-1 font-semibold">Receive stock</h2>
          <p className="mb-4 text-sm text-slate-500">Enter what actually arrived. Stock is added immediately and logged in the stock history. You can receive an order in several deliveries.</p>
          <ReceiveForm orderId={po.id} items={po.items.map((i) => ({ id: i.id, name: i.product.name, remaining: i.quantity - i.receivedQty }))} />
        </Card>
      )}
    </div>
  );
}
