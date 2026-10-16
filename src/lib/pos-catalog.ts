import "server-only";
import { can } from "@/lib/permissions";
import type { ShopUser } from "@/lib/session";
import { kampalaDateString } from "@/lib/time";
import { getSettings } from "@/lib/settings";
import { withShop } from "@/lib/tenant";
import type { PosCatalog } from "@/lib/offline/types";

/** Everything a till needs to keep selling without a connection. */
export async function buildCatalog(user: ShopUser): Promise<PosCatalog> {
  const generatedAt = new Date();
  const settings = await getSettings(user.shopId);
  const [products, categories] = await withShop(user.shopId, (db) => Promise.all([
    db.product.findMany({
      where: { isActive: true }, orderBy: { name: "asc" }, take: 3000,
      select: { id: true, name: true, sku: true, barcode: true, sellPrice: true, stock: true, categoryId: true, imageType: true, imageUpdatedAt: true, expiryDate: true },
    }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]));
  return {
    shopId: user.shopId, shopName: settings.name, address: settings.address, phone: settings.phone, receiptFooter: settings.receiptFooter, currency: settings.currency, receiptWidth: settings.receiptWidth, expiryAlertDays: settings.expiryAlertDays,
    userId: user.id, userName: user.name, canUploadAll: can(user.role, "sales.viewAll"), generatedAt: generatedAt.toISOString(),
    maxDiscountPercent: user.role === "CASHIER" ? settings.cashierMaxDiscountPercent : 100,
    products: products.map(({ imageType, imageUpdatedAt, expiryDate, ...p }) => ({ ...p, hasImage: !!imageType, imageV: imageUpdatedAt?.getTime() ?? 0, expiry: expiryDate ? kampalaDateString(expiryDate) : null })),
    categories,
  };
}
