import { rawDb } from "@/lib/db";
import { asPlatform, withShop, type Tx } from "@/lib/tenant";
import type { Role } from "@/generated/prisma/enums";

const url = process.env.DATABASE_URL!;
if (!/test/i.test(new URL(url).pathname)) throw new Error("Tests must use a database whose name contains 'test'.");

/** The unscoped owner connection: for set-up and for asserting what the database itself enforces. */
export const owner = rawDb;
export { asPlatform, withShop };
export type { Tx };

export async function dbAvailable() {
  try { await rawDb.$queryRaw`SELECT 1`; return true; } catch { return false; }
}

export async function resetDb() {
  await rawDb.$executeRawUnsafe(
    'TRUNCATE TABLE "SaleReturnItem","SaleReturn","SaleItem","Sale","StockMovement","PurchaseOrderItem","PurchaseOrder","Supplier","Product","Category","AuditLog","ReceiptCounter","Invoice","PlatformSettings","AuthToken","User","Shop" RESTART IDENTITY CASCADE',
  );
}

let n = 0;
const uniq = () => `${++n}-${Math.random().toString(36).slice(2, 7)}`;

export const makeShop = (name = `Shop ${uniq()}`, extra: Partial<{ isActive: boolean; cashierMaxDiscountPercent: number }> = {}) =>
  asPlatform((tx) => tx.shop.create({ data: { name, ...extra } }));

export const makeUser = (shopId: string | null, role: Role = "CASHIER", email = `u${uniq()}@test.local`) =>
  asPlatform((tx) => tx.user.create({ data: { shopId, name: `${role} ${uniq()}`, email, passwordHash: "x", role } }));

export const makeProduct = (
  shopId: string,
  o: Partial<{ name: string; price: number; cost: number; stock: number; isActive: boolean; minStock: number; sku: string }> = {},
) =>
  asPlatform((tx) =>
    tx.product.create({
      data: { shopId, sku: o.sku ?? `T-${uniq()}`, name: o.name ?? `Product ${uniq()}`, sellPrice: o.price ?? 2000, costPrice: o.cost ?? 1200, stock: o.stock ?? 10, minStock: o.minStock ?? 5, isActive: o.isActive ?? true },
    }),
  );

export const stockOf = (shopId: string, id: string) => withShop(shopId, async (tx) => (await tx.product.findUniqueOrThrow({ where: { id } })).stock);
