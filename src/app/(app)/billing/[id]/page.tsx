import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceView } from "@/components/invoice-view";
import { PrintInvoiceButton } from "@/components/print-invoice-button";
import { pageGuard } from "@/lib/guard";
import { invoiceFrom } from "@/lib/invoice-data";
import { withShop } from "@/lib/tenant";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: PageProps<"/billing/[id]">) {
  const user = await pageGuard("billing.view");
  const { id } = await params;
  const [inv, shop] = await Promise.all([
    withShop(user.shopId, (db) => db.invoice.findUnique({ where: { id } })),
    withShop(user.shopId, (db) => db.shop.findUniqueOrThrow({ where: { id: user.shopId }, select: { name: true, address: true, phone: true } })),
  ]);
  if (!inv || inv.status === "VOID") notFound(); // another shop's invoice is invisible, so it is simply "not found"
  return (
    <>
      <div className="no-print mb-4 flex gap-2">
        <PrintInvoiceButton />
        <Link href="/billing" className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">All invoices</Link>
      </div>
      <InvoiceView inv={{ ...inv, from: await invoiceFrom(), to: shop }} />
    </>
  );
}
