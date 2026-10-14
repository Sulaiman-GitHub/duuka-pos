import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { withShop } from "@/lib/tenant";
import { pageGuard } from "@/lib/guard";
import { createProduct } from "../actions";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const user = await pageGuard("products.manage");
  const categories = await withShop(user.shopId, (db) => db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }));
  return (
    <>
      <PageHeader title="New product" />
      <Card className="max-w-3xl p-6"><ProductForm action={createProduct} categories={categories} /></Card>
    </>
  );
}
