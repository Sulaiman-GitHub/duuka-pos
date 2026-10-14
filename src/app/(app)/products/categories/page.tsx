import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { pageGuard } from "@/lib/guard";
import { CategoryManager } from "./category-manager";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await pageGuard("products.manage");
  const categories = await db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, description: true, _count: { select: { products: true } } } });
  return (
    <>
      <PageHeader title="Categories" subtitle="Group products to make them easier to find and report on" />
      <Card className="max-w-2xl p-6">
        <CategoryManager categories={categories.map((c) => ({ id: c.id, name: c.name, description: c.description, count: c._count.products }))} />
      </Card>
    </>
  );
}
