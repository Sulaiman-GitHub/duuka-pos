import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui";
import { getSettings } from "@/lib/settings";
import { withShop } from "@/lib/tenant";
import { pageGuard } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/time";
import { ReceiptActions } from "@/components/receipt-actions";
import { ReceiptView } from "@/components/receipt-view";
import type { ReceiptData } from "@/lib/printing/types";
import { MarkReviewed } from "./mark-reviewed";

export const metadata: Metadata = { title: "Receipt" };

const METHOD_LABEL = { CASH: "Cash", MOBILE_MONEY: "Mobile Money", CARD: "Card", BANK_TRANSFER: "Bank transfer" } as const;

export default async function ReceiptPage({ params, searchParams }: PageProps<"/sales/[id]">) {
  const user = await pageGuard("sales.view");
  const { id } = await params;
  const sp = await searchParams;
  const business = await getSettings(user.shopId);
  const sale = await withShop(user.shopId, (db) =>
    db.sale.findUnique({
      where: { id },
      include: { cashier: { select: { name: true } }, items: { orderBy: { productName: "asc" } }, returns: { select: { refundTotal: true, createdAt: true, reason: true } } },
    }),
  );
  // Cashiers may only open their own receipts; the same "not found" avoids confirming other receipts exist.
  if (!sale || (sale.cashierId !== user.id && !can(user.role, "sales.viewAll"))) notFound();
  const refunded = sale.returns.reduce((s, r) => s + r.refundTotal, 0);

  const receipt: ReceiptData = {
    shopName: business.name, address: business.address, phone: business.phone, footer: business.receiptFooter, widthMm: business.receiptWidth,
    ref: sale.receiptNo, refNote: sale.offlineAt ? "Made offline, uploaded later" : undefined, dateText: formatDateTime(sale.createdAt), cashier: sale.cashier.name,
    customer: sale.customerName ?? undefined, customerPhone: sale.customerPhone ?? undefined,
    lines: sale.items.map((it) => ({ name: it.productName, quantity: it.quantity, unitPrice: it.unitPrice, lineTotal: it.lineTotal })),
    subtotal: sale.subtotal, discount: sale.discount, total: sale.total, paymentLabel: METHOD_LABEL[sale.paymentMethod], paid: sale.amountPaid, change: sale.changeGiven,
    reference: sale.note ?? undefined, refunded: refunded || undefined, currency: user.currency,
    status: sale.status === "COMPLETED" ? undefined : sale.status === "REFUNDED" ? "** FULLY REFUNDED **" : "** PARTLY REFUNDED **",
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        {sp.new && <div className="basis-full"><Alert tone="success">Sale completed successfully.</Alert></div>}
        {sale.needsReview && (
          <div className="basis-full"><Alert>
            <strong>Made offline — needs a manager&apos;s review.</strong> {sale.reviewNote}
            {can(user.role, "sales.refund") && <div className="mt-2"><MarkReviewed id={sale.id} /></div>}
          </Alert></div>
        )}
        {can(user.role, "pos.sell") && <Link href="/pos" className="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">New sale</Link>}
        {can(user.role, "sales.refund") && sale.status !== "REFUNDED" && <Link href={`/sales/${sale.id}/return`} className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Return / refund</Link>}
        <Link href="/sales" className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">All sales</Link>
        <div className="basis-full"><ReceiptActions data={receipt} autoPrint={!!sp.new} /></div>
      </div>

      <ReceiptView data={receipt} />
    </div>
  );
}
