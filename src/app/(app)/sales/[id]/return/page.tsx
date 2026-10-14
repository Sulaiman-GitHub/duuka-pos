import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { pageGuard } from "@/lib/guard";
import { ReturnForm } from "./return-form";

export const metadata: Metadata = { title: "Process return" };

export default async function ReturnPage({ params }: PageProps<"/sales/[id]/return">) {
  await pageGuard("sales.refund");
  const { id } = await params;
  const sale = await db.sale.findUnique({ where: { id }, include: { items: { include: { returns: { select: { quantity: true } } }, orderBy: { productName: "asc" } } } });
  if (!sale) notFound();
  return (
    <>
      <PageHeader title="Process return" subtitle={`Receipt ${sale.receiptNo}`} />
      <Card className="max-w-2xl p-6">
        <ReturnForm
          saleId={sale.id}
          subtotal={sale.subtotal}
          total={sale.total}
          items={sale.items.map((i) => ({ id: i.id, name: i.productName, unitPrice: i.unitPrice, remaining: i.quantity - i.returns.reduce((s, r) => s + r.quantity, 0) }))}
        />
      </Card>
    </>
  );
}
