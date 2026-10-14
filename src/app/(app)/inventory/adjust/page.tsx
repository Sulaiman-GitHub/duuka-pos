import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { pageGuard } from "@/lib/guard";
import { InventoryTabs } from "../tabs";
import { AdjustForm } from "./adjust-form";

export const metadata: Metadata = { title: "Adjust stock" };

export default async function AdjustPage({ searchParams }: PageProps<"/inventory/adjust">) {
  await pageGuard("inventory.adjust");
  const sp = await searchParams;
  const products = await db.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true, stock: true } });
  return (
    <>
      <PageHeader title="Inventory" subtitle="Add, remove or correct stock. Every change is recorded in the stock history." />
      <InventoryTabs active="adjust" canAdjust />
      <Card className="max-w-xl p-6"><AdjustForm products={products} selected={typeof sp.product === "string" ? sp.product : undefined} /></Card>
    </>
  );
}
