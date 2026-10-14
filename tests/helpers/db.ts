import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";

const url = process.env.DATABASE_URL!;
if (!/test/i.test(new URL(url).pathname)) throw new Error("Tests must use a database whose name contains 'test'.");

export const testDb = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 15 }) });

export async function dbAvailable() {
  try { await testDb.$queryRaw`SELECT 1`; return true; } catch { return false; }
}

export async function resetDb() {
  await testDb.$executeRawUnsafe(
    'TRUNCATE TABLE "SaleReturnItem","SaleReturn","SaleItem","Sale","StockMovement","PurchaseOrderItem","PurchaseOrder","Supplier","Product","Category","AuditLog","ShopSettings","ReceiptCounter","User" RESTART IDENTITY CASCADE',
  );
}

let n = 0;
export const makeUser = (role: Role = "CASHIER") => testDb.user.create({ data: { name: `${role} ${++n}`, email: `u${n}-${Date.now()}@test.local`, passwordHash: "x", role } });
export const makeProduct = (o: Partial<{ name: string; price: number; cost: number; stock: number; isActive: boolean; minStock: number }> = {}) =>
  testDb.product.create({ data: { sku: `T-${++n}-${Date.now()}`, name: o.name ?? `Product ${n}`, sellPrice: o.price ?? 2000, costPrice: o.cost ?? 1200, stock: o.stock ?? 10, minStock: o.minStock ?? 5, isActive: o.isActive ?? true } });
export const stockOf = async (id: string) => (await testDb.product.findUniqueOrThrow({ where: { id } })).stock;
