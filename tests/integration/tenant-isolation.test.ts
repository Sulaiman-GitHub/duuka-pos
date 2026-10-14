import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyStockChange } from "@/lib/inventory";
import { audit } from "@/lib/audit";
import { dbAvailable, makeProduct, makeShop, makeUser, owner, resetDb, asPlatform, withShop } from "../helpers/db";

const up = await dbAvailable();

/** Puts one row in every tenant table for a shop, using platform access, and returns the ids. */
async function populate(shopId: string, label: string) {
  const admin = await makeUser(shopId, "ADMIN", `admin-${label}@test.local`);
  const cashier = await makeUser(shopId, "CASHIER", `cashier-${label}@test.local`);
  const product = await makeProduct(shopId, { name: `${label} product`, sku: "SHARED-SKU", stock: 20 });
  const ids = await asPlatform(async (tx) => {
    const category = await tx.category.create({ data: { shopId, name: "Shared category" } });
    const supplier = await tx.supplier.create({ data: { shopId, name: `${label} supplier` } });
    const po = await tx.purchaseOrder.create({ data: { shopId, poNumber: "PO-0001", supplierId: supplier.id, createdById: admin.id, items: { create: [{ shopId, productId: product.id, quantity: 5, unitCost: 100 }] } } });
    const sale = await tx.sale.create({
      data: { shopId, receiptNo: "RCP-X-0001", cashierId: cashier.id, subtotal: 2000, total: 2000, paymentMethod: "CASH", amountPaid: 2000, items: { create: [{ shopId, productId: product.id, productName: product.name, sku: product.sku, quantity: 1, unitPrice: 2000, unitCost: 1200, lineTotal: 2000 }] } },
      include: { items: true },
    });
    const ret = await tx.saleReturn.create({ data: { shopId, saleId: sale.id, processedBy: admin.id, refundTotal: 2000, items: { create: [{ shopId, saleItemId: sale.items[0].id, quantity: 1, refundAmount: 2000 }] } } });
    await tx.stockMovement.create({ data: { shopId, productId: product.id, type: "INITIAL", quantity: 20, stockAfter: 20 } });
    await tx.receiptCounter.create({ data: { shopId, day: "2026-01-01", last: 1 } });
    await audit(tx, shopId, admin.id, "test.event");
    return { categoryId: category.id, supplierId: supplier.id, poId: po.id, saleId: sale.id, returnId: ret.id };
  });
  return { admin, cashier, product, ...ids };
}

// Delegates are looked up by name so every tenant table is covered by the same assertions.
const TENANT_MODELS = ["user", "category", "product", "stockMovement", "sale", "saleItem", "saleReturn", "saleReturnItem", "supplier", "purchaseOrder", "purchaseOrderItem", "auditLog", "receiptCounter"] as const;
type Delegate = { findMany: (a?: object) => Promise<{ shopId: string | null }[]>; count: () => Promise<number> };
const delegate = (tx: object, m: string) => (tx as Record<string, Delegate>)[m];

describe.skipIf(!up)("shop isolation (row-level security)", () => {
  let A: Awaited<ReturnType<typeof makeShop>>, B: Awaited<ReturnType<typeof makeShop>>;
  let a: Awaited<ReturnType<typeof populate>>, b: Awaited<ReturnType<typeof populate>>;

  beforeAll(resetDb);
  beforeEach(async () => {
    await resetDb();
    A = await makeShop("Shop A"); B = await makeShop("Shop B");
    a = await populate(A.id, "a"); b = await populate(B.id, "b");
  });

  it("shows a shop only its own rows in every business table, with no filter at all", async () => {
    for (const m of TENANT_MODELS) {
      const rows = await withShop(A.id, (tx) => delegate(tx, m).findMany());
      expect(rows.length, `${m} should have rows for shop A`).toBeGreaterThan(0);
      expect(rows.every((r) => r.shopId === A.id), `${m} leaked another shop's rows`).toBe(true);
    }
  });

  it("applies the same rule to raw SQL", async () => {
    const [{ n }] = await withShop(A.id, (tx) => tx.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "Product"`);
    expect(Number(n)).toBe(1);
    const joined = await withShop(A.id, (tx) => tx.$queryRaw<{ name: string }[]>`SELECT p.name FROM "SaleItem" si JOIN "Product" p ON p.id = si."productId"`);
    expect(joined.map((r) => r.name)).toEqual(["a product"]);
  });

  it("hides another shop's rows even when asked for them by exact id", async () => {
    await withShop(A.id, async (tx) => {
      expect(await tx.product.findUnique({ where: { id: b.product.id } })).toBeNull();
      expect(await tx.sale.findUnique({ where: { id: b.saleId } })).toBeNull();
      expect(await tx.user.findUnique({ where: { id: b.admin.id } })).toBeNull();
      expect(await tx.supplier.findUnique({ where: { id: b.supplierId } })).toBeNull();
      expect(await tx.shop.findUnique({ where: { id: B.id } })).toBeNull();
    });
  });

  it("cannot change or delete another shop's rows", async () => {
    await withShop(A.id, async (tx) => {
      expect((await tx.product.updateMany({ where: { id: b.product.id }, data: { name: "hacked" } })).count).toBe(0);
      expect((await tx.sale.updateMany({ where: { id: b.saleId }, data: { total: 1 } })).count).toBe(0);
      expect((await tx.user.updateMany({ where: { id: b.admin.id }, data: { isActive: false } })).count).toBe(0);
      expect((await tx.product.deleteMany({ where: { id: b.product.id } })).count).toBe(0);
      expect((await tx.shop.updateMany({ where: { id: B.id }, data: { name: "hacked" } })).count).toBe(0);
    });
    const after = await asPlatform((tx) => tx.product.findUniqueOrThrow({ where: { id: b.product.id } }));
    expect(after.name).toBe("b product");
  });

  it("refuses to write a row into another shop", async () => {
    await expect(withShop(A.id, (tx) => tx.product.create({ data: { shopId: B.id, sku: "EVIL", name: "x", costPrice: 1, sellPrice: 1 } }))).rejects.toThrow();
    await expect(withShop(A.id, (tx) => tx.category.create({ data: { shopId: B.id, name: "EVIL" } }))).rejects.toThrow();
    // Moving one of your own rows into another shop is a write to that shop too.
    await expect(withShop(A.id, (tx) => tx.product.update({ where: { id: a.product.id }, data: { shopId: B.id } }))).rejects.toThrow();
  });

  it("stamps new rows with the request's shop automatically", async () => {
    const p = await withShop(A.id, (tx) => tx.product.create({ data: { sku: "AUTO", name: "auto", costPrice: 1, sellPrice: 1 } }));
    expect(p.shopId).toBe(A.id);
    const nested = await withShop(B.id, (tx) => tx.sale.create({ data: { receiptNo: "N-1", cashierId: b.cashier.id, subtotal: 1, total: 1, paymentMethod: "CASH", amountPaid: 1, items: { create: [{ productId: b.product.id, productName: "x", sku: "x", quantity: 1, unitPrice: 1, unitCost: 1, lineTotal: 1 }] } }, include: { items: true } }));
    expect([nested.shopId, nested.items[0].shopId]).toEqual([B.id, B.id]);
  });

  it("shows nothing at all to a connection that sets no shop (even the owner role)", async () => {
    for (const m of TENANT_MODELS) expect(await delegate(owner, m).count(), m).toBe(0);
    expect(await owner.shop.count()).toBe(0);
  });

  it("shows nothing for an unknown shop id", async () => {
    for (const m of TENANT_MODELS) expect(await withShop("no-such-shop", (tx) => delegate(tx, m).count()), m).toBe(0);
  });

  it("lets only platform access see across shops", async () => {
    expect(await asPlatform((tx) => tx.shop.count())).toBe(2);
    expect(await asPlatform((tx) => tx.product.count())).toBe(2);
    expect(await asPlatform((tx) => tx.sale.count())).toBe(2);
  });

  it("keeps the platform owner invisible to shops", async () => {
    const platformOwner = await makeUser(null, "PLATFORM_OWNER", "owner@test.local");
    expect(await withShop(A.id, (tx) => tx.user.findUnique({ where: { id: platformOwner.id } }))).toBeNull();
    expect((await withShop(A.id, (tx) => tx.user.findMany())).map((u) => u.role).sort()).toEqual(["ADMIN", "CASHIER"]);
  });

  it("never leaks the shop context between requests that share pooled connections", async () => {
    const calls = Array.from({ length: 60 }, (_, i) => {
      const shop = i % 2 ? A : B;
      return withShop(shop.id, async (tx) => ({ expected: shop.id, rows: await tx.product.findMany(), sales: await tx.sale.count() }));
    });
    for (const r of await Promise.all(calls)) {
      expect(r.rows.every((p) => p.shopId === r.expected)).toBe(true);
      expect(r.rows).toHaveLength(1);
      expect(r.sales).toBe(1);
    }
    // ...and the owner connection is back to seeing nothing afterwards.
    expect(await owner.product.count()).toBe(0);
  });

  it("rolls everything back when a request fails, leaving no half-written data", async () => {
    await expect(withShop(A.id, async (tx) => { await tx.category.create({ data: { name: "temp" } }); throw new Error("boom"); })).rejects.toThrow("boom");
    expect(await withShop(A.id, (tx) => tx.category.count({ where: { name: "temp" } }))).toBe(0);
  });

  it("allows the same SKU, category name, receipt number and PO number in different shops, but not twice in one", async () => {
    // populate() already used the same values in both shops without clashing.
    expect(await withShop(A.id, (tx) => tx.product.count({ where: { sku: "SHARED-SKU" } }))).toBe(1);
    expect(await withShop(B.id, (tx) => tx.product.count({ where: { sku: "SHARED-SKU" } }))).toBe(1);
    await expect(withShop(A.id, (tx) => tx.product.create({ data: { sku: "SHARED-SKU", name: "dup", costPrice: 1, sellPrice: 1 } }))).rejects.toThrow();
    await expect(withShop(A.id, (tx) => tx.category.create({ data: { name: "Shared category" } }))).rejects.toThrow();
  });

  it("keeps an email unique across the whole platform: one email, one shop", async () => {
    await expect(makeUser(B.id, "CASHIER", "cashier-a@test.local")).rejects.toThrow();
  });

  it("enforces that only the platform owner has no shop", async () => {
    await expect(makeUser(null, "ADMIN")).rejects.toThrow();
    await expect(makeUser(A.id, "PLATFORM_OWNER")).rejects.toThrow();
    await expect(makeUser(null, "PLATFORM_OWNER")).resolves.toBeTruthy();
  });

  it("scopes stock movements written through the stock ledger to the right shop", async () => {
    await withShop(A.id, (tx) => applyStockChange(tx, a.product.id, -2, "SALE"));
    expect(await withShop(A.id, (tx) => tx.stockMovement.count({ where: { type: "SALE" } }))).toBe(1);
    expect(await withShop(B.id, (tx) => tx.stockMovement.count({ where: { type: "SALE" } }))).toBe(0);
    // Shop A cannot even see shop B's product to adjust it.
    await expect(withShop(A.id, (tx) => applyStockChange(tx, b.product.id, -1, "SALE"))).rejects.toThrow(/Product not found|Not enough stock/);
  });

  it("runs requests as the restricted role", async () => {
    const [{ r }] = await withShop(A.id, (tx) => tx.$queryRaw<{ r: string }[]>`SELECT current_user AS r`);
    expect(r).toBe("duuka_app");
  });
});
