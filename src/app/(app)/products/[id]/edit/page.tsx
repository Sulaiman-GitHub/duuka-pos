import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { pageGuard } from "@/lib/guard";
import { updateProduct } from "../../actions";
import { ProductForm } from "../../product-form";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: PageProps<"/products/[id]/edit">) {
  await pageGuard("products.manage");
  const { id } = await params;
  const [p, categories] = await Promise.all([
    db.product.findUnique({ where: { id }, omit: { imageData: true } }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!p) notFound();
  const hasImage = !!p.imageType;
  return (
    <>
      <PageHeader title={`Edit ${p.name}`} subtitle={p.sku} />
      <Card className="max-w-3xl p-6">
        <ProductForm action={updateProduct.bind(null, id)} categories={categories} product={{ ...p, hasImage }} />
      </Card>
    </>
  );
}
