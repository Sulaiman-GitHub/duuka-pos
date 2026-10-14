import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyStockChange, StockError } from "@/lib/inventory";
import { dbAvailable, makeProduct, makeUser, resetDb, stockOf, testDb } from "../helpers/db";

const up = await dbAvailable();

describe.skipIf(!up)("stock ledger (applyStockChange)", () => {
  beforeAll(resetDb);
  beforeEach(resetDb);

  it("adds and removes stock, recording a ledger row with the resulting balance", async () => {
    const p = await makeProduct({ stock: 10 }), u = await makeUser();
    await testDb.$transaction((tx) => applyStockChange(tx, p.id, -3, "SALE", { userId: u.id, reference: "R1" }));
    await testDb.$transaction((tx) => applyStockChange(tx, p.id, 5, "PURCHASE", { userId: u.id, reason: "restock" }));
    expect(await stockOf(p.id)).toBe(12);
    const rows = await testDb.stockMovement.findMany({ where: { productId: p.id }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => [r.type, r.quantity, r.stockAfter])).toEqual([["SALE", -3, 7], ["PURCHASE", 5, 12]]);
  });

  it("never lets stock go below zero, and leaves no trace of the failed attempt", async () => {
    const p = await makeProduct({ stock: 2 });
    await expect(testDb.$transaction((tx) => applyStockChange(tx, p.id, -3, "SALE"))).rejects.toThrow(StockError);
    expect(await stockOf(p.id)).toBe(2);
    expect(await testDb.stockMovement.count({ where: { productId: p.id } })).toBe(0);
  });

  it("refuses to sell an inactive product but still allows receiving stock for it", async () => {
    const p = await makeProduct({ stock: 5, isActive: false });
    await expect(testDb.$transaction((tx) => applyStockChange(tx, p.id, -1, "SALE"))).rejects.toThrow(/inactive/);
    await testDb.$transaction((tx) => applyStockChange(tx, p.id, 3, "PURCHASE", { allowInactive: true }));
    expect(await stockOf(p.id)).toBe(8);
  });

  it("rejects zero and fractional quantities", async () => {
    const p = await makeProduct();
    await expect(testDb.$transaction((tx) => applyStockChange(tx, p.id, 0, "SALE"))).rejects.toThrow(StockError);
    await expect(testDb.$transaction((tx) => applyStockChange(tx, p.id, 1.5, "SALE"))).rejects.toThrow(StockError);
  });

  it("stays correct under concurrency: 12 simultaneous sales of 5 units succeed exactly 5 times", async () => {
    const p = await makeProduct({ stock: 5 });
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => testDb.$transaction((tx) => applyStockChange(tx, p.id, -1, "SALE"))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    expect(results.filter((r) => r.status === "rejected" && r.reason instanceof StockError)).toHaveLength(7);
    expect(await stockOf(p.id)).toBe(0);
    expect(await testDb.stockMovement.count({ where: { productId: p.id } })).toBe(5);
  });
});
