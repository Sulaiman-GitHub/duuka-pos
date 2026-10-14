import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { pageGuard } from "@/lib/guard";
import { OrderForm } from "./order-form";

export const metadata: Metadata = { title: "New purchase order" };

export default async function NewOrderPage({ searchParams }: PageProps<"/suppliers/orders/new">) {
  await pageGuard("suppliers.manage");
  const sp = await searchParams;
  const [suppliers, products] = await Promise.all([
    db.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true, costPrice: true, stock: true, minStock: true } }),
  ]);
  return (
    <>
      <PageHeader title="New purchase order" subtitle="Low-stock products are suggested first" />
      <Card className="max-w-4xl p-6"><OrderForm suppliers={suppliers} products={products} supplierId={typeof sp.supplier === "string" ? sp.supplier : undefined} /></Card>
    </>
  );
}
