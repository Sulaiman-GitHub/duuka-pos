import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge } from "@/components/ui";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { pageGuard } from "@/lib/guard";
import { formatUGX } from "@/lib/money";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/time";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Receipt" };

const METHOD_LABEL = { CASH: "Cash", MOBILE_MONEY: "Mobile Money", CARD: "Card", BANK_TRANSFER: "Bank transfer" } as const;

export default async function ReceiptPage({ params, searchParams }: PageProps<"/sales/[id]">) {
  const user = await pageGuard("sales.view");
  const { id } = await params;
  const sp = await searchParams;
  const business = await getSettings();
  const sale = await db.sale.findUnique({
    where: { id },
    include: { cashier: { select: { name: true } }, items: { orderBy: { productName: "asc" } }, returns: { select: { refundTotal: true, createdAt: true, reason: true } } },
  });
  // Cashiers may only open their own receipts; the same "not found" avoids confirming other receipts exist.
  if (!sale || (sale.cashierId !== user.id && !can(user.role, "sales.viewAll"))) notFound();
  const refunded = sale.returns.reduce((s, r) => s + r.refundTotal, 0);

  return (
    <div className="mx-auto max-w-md">
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        {sp.new && <div className="basis-full"><Alert tone="success">Sale completed successfully.</Alert></div>}
        <PrintButton />
        {can(user.role, "pos.sell") && <Link href="/pos" className="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">New sale</Link>}
        {can(user.role, "sales.refund") && sale.status !== "REFUNDED" && <Link href={`/sales/${sale.id}/return`} className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Return / refund</Link>}
        <Link href="/sales" className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">All sales</Link>
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-6 font-mono text-sm shadow-sm print:border-0 print:shadow-none">
        <header className="text-center">
          <h1 className="text-lg font-bold">{business.name}</h1>
          <p className="text-xs text-slate-600">{business.address}</p>
          <p className="text-xs text-slate-600">{business.phone}</p>
        </header>
        <div className="my-4 space-y-0.5 border-y border-dashed border-slate-300 py-3 text-xs">
          <div className="flex justify-between"><span>Receipt</span><span className="font-semibold">{sale.receiptNo}</span></div>
          <div className="flex justify-between"><span>Date</span><span>{formatDateTime(sale.createdAt)}</span></div>
          <div className="flex justify-between"><span>Cashier</span><span>{sale.cashier.name}</span></div>
          {sale.customerName && <div className="flex justify-between"><span>Customer</span><span>{sale.customerName}</span></div>}
          {sale.status !== "COMPLETED" && <div className="pt-1"><Badge tone="amber">{sale.status === "REFUNDED" ? "Fully refunded" : "Partially refunded"}</Badge></div>}
        </div>
        <table className="w-full text-xs">
          <thead><tr className="text-left"><th className="pb-1 font-semibold">Item</th><th className="pb-1 text-right font-semibold">Qty</th><th className="pb-1 text-right font-semibold">Amount</th></tr></thead>
          <tbody>
            {sale.items.map((it) => (
              <tr key={it.id} className="align-top">
                <td className="py-0.5 pr-2">{it.productName}<div className="text-slate-500">@ {it.unitPrice.toLocaleString()}</div></td>
                <td className="py-0.5 text-right">{it.quantity}</td>
                <td className="py-0.5 text-right">{it.lineTotal.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-3 space-y-0.5 border-t border-dashed border-slate-300 pt-3 text-xs">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatUGX(sale.subtotal)}</dd></div>
          {sale.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>− {formatUGX(sale.discount)}</dd></div>}
          <div className="flex justify-between text-base font-bold"><dt>TOTAL</dt><dd>{formatUGX(sale.total)}</dd></div>
          <div className="flex justify-between"><dt>Paid ({METHOD_LABEL[sale.paymentMethod]})</dt><dd>{formatUGX(sale.amountPaid)}</dd></div>
          {sale.changeGiven > 0 && <div className="flex justify-between"><dt>Change</dt><dd>{formatUGX(sale.changeGiven)}</dd></div>}
          {sale.note && <div className="flex justify-between"><dt>Ref</dt><dd>{sale.note}</dd></div>}
          {refunded > 0 && <div className="flex justify-between text-red-600"><dt>Refunded</dt><dd>− {formatUGX(refunded)}</dd></div>}
        </dl>
        <p className="mt-5 text-center text-xs text-slate-600">{business.receiptFooter}</p>
      </article>
    </div>
  );
}
