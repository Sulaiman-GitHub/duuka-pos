import { beforeEach, describe, expect, it } from "vitest";
import { expiryCounts, expiryWhere } from "@/lib/expiry";
import { applyStockChange, StockError } from "@/lib/inventory";
import { dbAvailable, makeProduct, makeShop, makeUser, resetDb, stockOf, withShop } from "../helpers/db";

const up = await dbAvailable();

describe.skipIf(!up)("stock ledger (applyStockChange)", () => {
  let shop: Awaited<ReturnType<typeof makeShop>>;
  beforeEach(async () => { await resetDb(); shop = await makeShop(); });
  const change = (productId: string, delta: number, type: Parameters<typeof applyStockChange>[3], opts: Parameters<typeof applyStockChange>[4] = {}) =>
    withShop(shop.id, (tx) => applyStockChange(tx, productId, delta, type, opts));

  it("adds and removes stock, recording a ledger row with the resulting balance", async () => {
    const p = await makeProduct(shop.id, { stock: 10 }), u = await makeUser(shop.id);
    await change(p.id, -3, "SALE", { userId: u.id, reference: "R1" });
    await change(p.id, 5, "PURCHASE", { userId: u.id, reason: "restock" });
    expect(await stockOf(shop.id, p.id)).toBe(12);
    const rows = await withShop(shop.id, (tx) => tx.stockMovement.findMany({ where: { productId: p.id }, orderBy: { createdAt: "asc" } }));
    expect(rows.map((r) => [r.type, r.quantity, r.stockAfter, r.shopId])).toEqual([["SALE", -3, 7, shop.id], ["PURCHASE", 5, 12, shop.id]]);
  });

  it("never lets stock go below zero, and leaves no trace of the failed attempt", async () => {
    const p = await makeProduct(shop.id, { stock: 2 });
    await expect(change(p.id, -3, "SALE")).rejects.toThrow(StockError);
    expect(await stockOf(shop.id, p.id)).toBe(2);
    expect(await withShop(shop.id, (tx) => tx.stockMovement.count({ where: { productId: p.id } }))).toBe(0);
  });

  it("refuses to sell an inactive product but still allows receiving stock for it", async () => {
    const p = await makeProduct(shop.id, { stock: 5, isActive: false });
    await expect(change(p.id, -1, "SALE")).rejects.toThrow(/inactive/);
    await change(p.id, 3, "PURCHASE", { allowInactive: true });
    expect(await stockOf(shop.id, p.id)).toBe(8);
  });

  it("rejects zero and fractional quantities", async () => {
    const p = await makeProduct(shop.id);
    await expect(change(p.id, 0, "SALE")).rejects.toThrow(StockError);
    await expect(change(p.id, 1.5, "SALE")).rejects.toThrow(StockError);
  });

  it("stays correct under concurrency: 12 simultaneous sales of 5 units succeed exactly 5 times", async () => {
    const p = await makeProduct(shop.id, { stock: 5 });
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => change(p.id, -1, "SALE")));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    expect(results.filter((r) => r.status === "rejected" && r.reason instanceof StockError)).toHaveLength(7);
    expect(await stockOf(shop.id, p.id)).toBe(0);
    expect(await withShop(shop.id, (tx) => tx.stockMovement.count({ where: { productId: p.id } }))).toBe(5);
  });
});

describe.skipIf(!up)("expiry alerts", () => {
  beforeEach(resetDb);
  const now = new Date("2026-10-16T10:00:00+03:00");
  const on = (d: string) => new Date(`${d}T00:00:00+03:00`);

  it("counts expired and soon-to-expire products that are in stock, and ignores the rest", async () => {
    const shop = await makeShop();
    await makeProduct(shop.id, { name: "expired", stock: 4, expiryDate: on("2026-10-10") });
    await makeProduct(shop.id, { name: "yesterday", stock: 4, expiryDate: on("2026-10-15") });
    await makeProduct(shop.id, { name: "today", stock: 4, expiryDate: on("2026-10-16") });
    await makeProduct(shop.id, { name: "in 30 days", stock: 4, expiryDate: on("2026-11-15") });
    await makeProduct(shop.id, { name: "in 31 days", stock: 4, expiryDate: on("2026-11-16") });
    await makeProduct(shop.id, { name: "expired but none left", stock: 0, expiryDate: on("2026-10-01") });
    await makeProduct(shop.id, { name: "expired but inactive", stock: 4, isActive: false, expiryDate: on("2026-10-01") });
    await makeProduct(shop.id, { name: "never expires", stock: 4 });
    const c = await withShop(shop.id, (tx) => expiryCounts(tx, 30, now));
    expect(c).toMatchObject({ expired: 2, soon: 2 }); // expired + yesterday | today + in 30 days
    expect(c.tracked).toBe(6); // active products that use expiry dates (the inactive one is not counted)
    const names = await withShop(shop.id, (tx) => tx.product.findMany({ where: expiryWhere("expired", 30, now), orderBy: { name: "asc" } }));
    expect(names.map((p) => p.name)).toEqual(["expired", "yesterday"]);
  });

  it("is limited to the shop's own products", async () => {
    const a = await makeShop(), b = await makeShop();
    await makeProduct(a.id, { stock: 3, expiryDate: on("2026-10-01") });
    await makeProduct(b.id, { stock: 3, expiryDate: on("2026-10-01") });
    expect((await withShop(a.id, (tx) => expiryCounts(tx, 30, now))).expired).toBe(1);
  });
});
