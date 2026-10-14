import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { pageGuard } from "@/lib/guard";
import { PosTerminal } from "./terminal";

export const metadata: Metadata = { title: "Point of Sale" };

export default async function PosPage() {
  const user = await pageGuard("pos.sell");
  const settings = await getSettings();
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { isActive: true }, orderBy: { name: "asc" }, take: 3000,
      select: { id: true, name: true, sku: true, barcode: true, sellPrice: true, stock: true, categoryId: true, imageType: true },
    }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <PosTerminal
      products={products.map(({ imageType, ...p }) => ({ ...p, hasImage: !!imageType }))}
      categories={categories}
      maxDiscountPercent={user.role === "CASHIER" ? settings.cashierMaxDiscountPercent : 100}
    />
  );
}
