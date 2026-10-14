import { beforeEach, describe, expect, it } from "vitest";
import { returnInShop } from "@/lib/returns";
import { sellInShop } from "@/lib/sales";
import { dbAvailable, makeProduct, makeShop, makeUser, resetDb, stockOf, withShop } from "../helpers/db";

const up = await dbAvailable();
const rules = { cashierMaxDiscountPercent: 10 };

describe.skipIf(!up)("returns and refunds", () => {
  let shop: Awaited<ReturnType<typeof makeShop>>, mgr: Awaited<ReturnType<typeof makeUser>>;
  let a: Awaited<ReturnType<typeof makeProduct>>, b: Awaited<ReturnType<typeof makeProduct>>;
  let saleId: string, itemA: string, itemB: string;
  const read = <T,>(fn: Parameters<typeof withShop<T>>[1]) => withShop(shop.id, fn);

  // A x2 (2,000) + B x1 (5,000) = 9,000, 10% discount -> total 8,100, so refunds are worth 90% of price.
  beforeEach(async () => {
    await resetDb();
    shop = await makeShop(); mgr = await makeUser(shop.id, "MANAGER");
    a = await makeProduct(shop.id, { name: "A", price: 2000, cost: 1200, stock: 10 });
    b = await makeProduct(shop.id, { name: "B", price: 5000, cost: 3000, stock: 10 });
    const r = await sellInShop(shop.id, mgr, { items: [{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 1 }], discountType: "percent", discountValue: 10, paymentMethod: "CARD", amountPaid: 0 }, rules);
    saleId = r.saleId!;
    const items = await read((tx) => tx.saleItem.findMany({ where: { saleId } }));
    itemA = items.find((i) => i.productName === "A")!.id; itemB = items.find((i) => i.productName === "B")!.id;
  });

  const ret = (items: { saleItemId: string; quantity: number }[], restock = true, sid = saleId, forShop = shop.id) =>
    returnInShop(forShop, mgr, { saleId: sid, reason: "test return", restock, items });

  it("refunds the price actually paid (discount shared proportionally) and restocks", async () => {
    const r = await ret([{ saleItemId: itemA, quantity: 1 }]);
    expect(r).toMatchObject({ ok: true, refundTotal: 1800 });
    expect((await read((tx) => tx.sale.findUniqueOrThrow({ where: { id: saleId } }))).status).toBe("PARTIALLY_REFUNDED");
    expect(await stockOf(shop.id, a.id)).toBe(9);
  });

  it("settles to exactly the amount paid once everything is returned", async () => {
    await ret([{ saleItemId: itemA, quantity: 1 }]);
    const last = await ret([{ saleItemId: itemA, quantity: 1 }, { saleItemId: itemB, quantity: 1 }]);
    expect(last.ok).toBe(true);
    const total = (await read((tx) => tx.saleReturn.findMany({ where: { saleId } }))).reduce((s, x) => s + x.refundTotal, 0);
    expect(total).toBe(8100);
    expect((await read((tx) => tx.sale.findUniqueOrThrow({ where: { id: saleId } }))).status).toBe("REFUNDED");
    expect([await stockOf(shop.id, a.id), await stockOf(shop.id, b.id)]).toEqual([10, 10]);
  });

  it("does not put items back in stock when told not to", async () => {
    await ret([{ saleItemId: itemA, quantity: 1 }], false);
    expect(await stockOf(shop.id, a.id)).toBe(8);
  });

  it("refuses to return more than was sold or already returned", async () => {
    expect((await ret([{ saleItemId: itemA, quantity: 3 }])).error).toMatch(/Only 2 of "A"/);
    await ret([{ saleItemId: itemB, quantity: 1 }]);
    expect((await ret([{ saleItemId: itemB, quantity: 1 }])).error).toMatch(/Only 0 of "B"/);
  });

  it("cannot be tricked by listing the same item twice in one request", async () => {
    const r = await ret([{ saleItemId: itemB, quantity: 1 }, { saleItemId: itemB, quantity: 1 }]); // B was only sold once
    expect(r.error).toMatch(/Only 1 of "B"/);
    expect(await read((tx) => tx.saleReturn.count())).toBe(0);
    expect(await stockOf(shop.id, b.id)).toBe(9);
  });

  it("rejects items from another sale and empty requests", async () => {
    const other = await sellInShop(shop.id, mgr, { items: [{ productId: a.id, quantity: 1 }], discountType: "amount", discountValue: 0, paymentMethod: "CARD", amountPaid: 0 }, rules);
    const foreign = (await read((tx) => tx.saleItem.findFirstOrThrow({ where: { saleId: other.saleId } }))).id;
    expect((await ret([{ saleItemId: foreign, quantity: 1 }])).error).toMatch(/does not belong/);
    expect((await ret([{ saleItemId: itemA, quantity: 0 }])).error).toMatch(/at least one item/);
  });

  it("lets only one of two simultaneous refunds of the same items succeed", async () => {
    const results = await Promise.all([ret([{ saleItemId: itemA, quantity: 2 }]), ret([{ saleItemId: itemA, quantity: 2 }])]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await read((tx) => tx.saleReturn.count())).toBe(1);
    expect(await stockOf(shop.id, a.id)).toBe(10);
  });

  it("never refunds more than was paid, even with awkward rounding", async () => {
    const odd = await makeProduct(shop.id, { price: 3333, cost: 1000, stock: 10 });
    const s = await sellInShop(shop.id, mgr, { items: [{ productId: odd.id, quantity: 3 }], discountType: "amount", discountValue: 1000, paymentMethod: "CARD", amountPaid: 0 }, rules); // 9,999 - 1,000 = 8,999
    const item = (await read((tx) => tx.saleItem.findFirstOrThrow({ where: { saleId: s.saleId } }))).id;
    for (let i = 0; i < 3; i++) expect((await ret([{ saleItemId: item, quantity: 1 }], true, s.saleId)).ok).toBe(true);
    const refunded = (await read((tx) => tx.saleReturn.findMany({ where: { saleId: s.saleId } }))).reduce((t, x) => t + x.refundTotal, 0);
    expect(refunded).toBe(8999);
  });

  it("cannot refund another shop's sale", async () => {
    const other = await makeShop("Other shop");
    const r = await ret([{ saleItemId: itemA, quantity: 1 }], true, saleId, other.id);
    expect(r.error).toBe("Sale not found.");
    expect(await stockOf(shop.id, a.id)).toBe(8); // untouched
    expect(await read((tx) => tx.saleReturn.count())).toBe(0);
  });
});
