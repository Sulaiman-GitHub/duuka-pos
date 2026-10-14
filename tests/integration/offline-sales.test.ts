import { beforeEach, describe, expect, it } from "vitest";
import { sellInShop, type SaleInput } from "@/lib/sales";
import { dbAvailable, makeProduct, makeShop, makeUser, resetDb, asPlatform, withShop } from "../helpers/db";

const up = await dbAvailable();
const rules = { cashierMaxDiscountPercent: 10 };
const sale = (productId: string, quantity = 1, extra: Partial<SaleInput> = {}): SaleInput => ({
  items: [{ productId, quantity }], discountType: "amount", discountValue: 0, paymentMethod: "CASH", amountPaid: 100000, ...extra,
});
const offlineCtx = (clientId: string, o: Partial<{ at: Date; catalogAt: Date | null; prices: Record<string, number>; expectedTotal: number }> = {}) =>
  ({ clientId, offline: { at: new Date(Date.now() - 3600_000), catalogAt: new Date(Date.now() - 7200_000), prices: {}, ...o } });
const saleRow = (shopId: string, clientId: string) => withShop(shopId, (tx) => tx.sale.findFirstOrThrow({ where: { clientId }, include: { items: true } }));
const stockOf = (shopId: string, id: string) => withShop(shopId, async (tx) => (await tx.product.findUniqueOrThrow({ where: { id } })).stock);

describe.skipIf(!up)("sales uploaded from a till", () => {
  beforeEach(resetDb);

  it("uploading the same sale twice records it once (live and offline)", async () => {
    const shop = await makeShop(); const cashier = await makeUser(shop.id); const p = await makeProduct(shop.id, { stock: 10, price: 2000 });
    const a = await sellInShop(shop.id, cashier, sale(p.id), rules, new Date(), { clientId: "till-sale-0001" });
    const b = await sellInShop(shop.id, cashier, sale(p.id), rules, new Date(), { clientId: "till-sale-0001" });
    expect(a.saleId).toBeTruthy();
    expect(b).toMatchObject({ saleId: a.saleId, receiptNo: a.receiptNo, duplicate: true });
    expect(await stockOf(shop.id, p.id)).toBe(9); // deducted once
    const c = await sellInShop(shop.id, cashier, sale(p.id), rules, new Date(), offlineCtx("till-sale-0002"));
    const d = await sellInShop(shop.id, cashier, sale(p.id), rules, new Date(), offlineCtx("till-sale-0002"));
    expect(d.duplicate).toBe(true); expect(d.saleId).toBe(c.saleId);
    expect(await stockOf(shop.id, p.id)).toBe(8);
  });

  it("two uploads of the same sale at the same moment still produce one sale", async () => {
    const shop = await makeShop(); const cashier = await makeUser(shop.id); const p = await makeProduct(shop.id, { stock: 10 });
    const rs = await Promise.all([1, 2, 3].map(() => sellInShop(shop.id, cashier, sale(p.id), rules, new Date(), offlineCtx("till-race-0001"))));
    expect(new Set(rs.map((r) => r.saleId)).size).toBe(1);
    expect(await stockOf(shop.id, p.id)).toBe(9);
  });

  it("an offline sale is accepted even when stock has run out, and is flagged for review", async () => {
    const shop = await makeShop(); const cashier = await makeUser(shop.id); const p = await makeProduct(shop.id, { stock: 1, price: 2000 });
    const r = await sellInShop(shop.id, cashier, sale(p.id, 3), rules, new Date(), offlineCtx("till-sale-0003"));
    expect(r.error).toBeUndefined();
    expect(await stockOf(shop.id, p.id)).toBe(-2);
    const row = await saleRow(shop.id, "till-sale-0003");
    expect(row.needsReview).toBe(true);
    expect(row.reviewNote).toContain("stock is now -2");
    expect(row.offlineAt).not.toBeNull();
  });

  it("a live (online) sale still refuses to oversell", async () => {
    const shop = await makeShop(); const cashier = await makeUser(shop.id); const p = await makeProduct(shop.id, { stock: 1 });
    const r = await sellInShop(shop.id, cashier, sale(p.id, 3), rules, new Date(), { clientId: "till-live-0001" });
    expect(r.error).toMatch(/Not enough stock/);
    expect(await stockOf(shop.id, p.id)).toBe(1);
  });

  it("honours the price the till showed only if the price could have changed since the till last synced", async () => {
    const shop = await makeShop(); const cashier = await makeUser(shop.id);
    const changed = await makeProduct(shop.id, { stock: 10, price: 3000 }); // created just now, i.e. after the snapshot below
    await sellInShop(shop.id, cashier, sale(changed.id), rules, new Date(), offlineCtx("till-price-0001", { prices: { [changed.id]: 2000 } }));
    const row = await saleRow(shop.id, "till-price-0001");
    expect(row.items[0].unitPrice).toBe(2000);
    expect(row.reviewNote).toContain("price has since changed");

    // Snapshot taken AFTER the product's last change: a different price from the till cannot be genuine, so it is ignored.
    const stable = await makeProduct(shop.id, { stock: 10, price: 3000 });
    await sellInShop(shop.id, cashier, sale(stable.id), rules, new Date(), offlineCtx("till-price-0002", { prices: { [stable.id]: 1 }, catalogAt: new Date(Date.now() + 60_000) }));
    const forged = await saleRow(shop.id, "till-price-0002");
    expect(forged.items[0].unitPrice).toBe(3000);
    expect(forged.needsReview).toBe(true);
  });

  it("flags rather than rejects an over-limit discount made offline, but a live one is refused", async () => {
    const shop = await makeShop(); const cashier = await makeUser(shop.id, "CASHIER"); const p = await makeProduct(shop.id, { stock: 10, price: 10000 });
    const big = sale(p.id, 1, { discountType: "percent", discountValue: 50 });
    const off = await sellInShop(shop.id, cashier, big, rules, new Date(), offlineCtx("till-disc-0001"));
    expect(off.error).toBeUndefined();
    expect((await saleRow(shop.id, "till-disc-0001")).reviewNote).toContain("above the cashier limit");
    expect((await sellInShop(shop.id, cashier, big, rules, new Date(), { clientId: "till-disc-0002" })).error).toMatch(/at most 10%/);
  });

  it("flags a total that differs from what the till charged", async () => {
    const shop = await makeShop(); const cashier = await makeUser(shop.id); const p = await makeProduct(shop.id, { stock: 10, price: 2000 });
    await sellInShop(shop.id, cashier, sale(p.id), rules, new Date(), offlineCtx("till-tot-0001", { expectedTotal: 1500 }));
    expect((await saleRow(shop.id, "till-tot-0001")).reviewNote).toContain("the till charged 1500");
  });

  it("records the time the sale happened, never a time in the future", async () => {
    const shop = await makeShop(); const cashier = await makeUser(shop.id); const p = await makeProduct(shop.id, { stock: 10 });
    const past = new Date(Date.now() - 5 * 3600_000);
    await sellInShop(shop.id, cashier, sale(p.id), rules, new Date(), offlineCtx("till-time-0001", { at: past }));
    expect((await saleRow(shop.id, "till-time-0001")).createdAt.getTime()).toBe(past.getTime());
    await sellInShop(shop.id, cashier, sale(p.id), rules, new Date(), offlineCtx("till-time-0002", { at: new Date(Date.now() + 86400_000) }));
    expect((await saleRow(shop.id, "till-time-0002")).createdAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("cannot sell another shop's product, and the same clientId in two shops is two different sales", async () => {
    const a = await makeShop(); const b = await makeShop();
    const ca = await makeUser(a.id); const cb = await makeUser(b.id);
    const pa = await makeProduct(a.id, { stock: 5 }); const pb = await makeProduct(b.id, { stock: 5 });
    expect((await sellInShop(b.id, cb, sale(pa.id), rules, new Date(), offlineCtx("till-x-0000001"))).error).toMatch(/no longer exists/);
    const r1 = await sellInShop(a.id, ca, sale(pa.id), rules, new Date(), offlineCtx("till-same-0001"));
    const r2 = await sellInShop(b.id, cb, sale(pb.id), rules, new Date(), offlineCtx("till-same-0001"));
    expect(r1.saleId).not.toBe(r2.saleId);
    expect(await asPlatform((tx) => tx.sale.count())).toBe(2);
  });

  it("gives offline sales proper sequential receipt numbers when they are uploaded", async () => {
    const shop = await makeShop(); const cashier = await makeUser(shop.id); const p = await makeProduct(shop.id, { stock: 10 });
    const a = await sellInShop(shop.id, cashier, sale(p.id), rules, new Date(), offlineCtx("till-rn-000001"));
    const b = await sellInShop(shop.id, cashier, sale(p.id), rules, new Date(), offlineCtx("till-rn-000002"));
    expect(a.receiptNo).toMatch(/-0001$/); expect(b.receiptNo).toMatch(/-0002$/);
  });
});
