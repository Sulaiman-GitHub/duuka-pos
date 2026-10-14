import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceView } from "@/components/invoice-view";
import { PrintInvoiceButton } from "@/components/print-invoice-button";
import { platformGuard } from "@/lib/guard";
import { invoiceFrom } from "@/lib/invoice-data";
import { asPlatform } from "@/lib/tenant";

export const metadata: Metadata = { title: "Invoice" };

export default async function PlatformInvoicePage({ params }: PageProps<"/platform/invoices/[id]">) {
  await platformGuard();
  const { id } = await params;
  const inv = await asPlatform((tx) => tx.invoice.findUnique({ where: { id }, include: { shop: { select: { id: true, name: true, address: true, phone: true } } } }));
  if (!inv) notFound();
  return (
    <>
      <div className="no-print mb-4 flex gap-2">
        <PrintInvoiceButton />
        <Link href={`/platform/shops/${inv.shop.id}#billing`} className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Back to shop</Link>
      </div>
      <InvoiceView inv={{ ...inv, from: await invoiceFrom(), to: inv.shop }} />
    </>
  );
}
