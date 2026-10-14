import { beforeEach, describe, expect, it } from "vitest";
import { sellInShop, type SaleInput } from "@/lib/sales";
import { dbAvailable, makeProduct, makeShop, makeUser, resetDb, stockOf, withShop } from "../helpers/db";

const up = await dbAvailable();
const rules = { cashierMaxDiscountPercent: 10 };
const input = (items: SaleInput["items"], o: Partial<SaleInput> = {}): SaleInput => ({ items, discountType: "amount", discountValue: 0, paymentMethod: "CASH", amountPaid: 100000, ...o });

describe.skipIf(!up)("completing a sale", () => {
  let shop: Awaited<ReturnType<typeof makeShop>>;
  let cashier: Awaited<ReturnType<typeof makeUser>>, manager: Awaited<ReturnType<typeof makeUser>>;
  let a: Awaited<ReturnType<typeof makeProduct>>, b: Awaited<ReturnType<typeof makeProduct>>;
  const sell = (actor: { id: string; role: "ADMIN" | "MANAGER" | "CASHIER" | "PLATFORM_OWNER" }, i: SaleInput, r = rules, now?: Date) => sellInShop(shop.id, actor, i, r, now);
  const read = <T,>(fn: Parameters<typeof withShop<T>>[1]) => withShop(shop.id, fn);

  beforeEach(async () => {
    await resetDb();
    shop = await makeShop();
    cashier = await makeUser(shop.id, "CASHIER"); manager = await makeUser(shop.id, "MANAGER");
    a = await makeProduct(shop.id, { name: "A", price: 2000, cost: 1200, stock: 10 });
    b = await makeProduct(shop.id, { name: "B", price: 5000, cost: 3000, stock: 3 });
  });

  it("prices the sale from the database and deducts stock", async () => {
    const r = await sell(cashier, input([{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 1 }]));
    expect(r.error).toBeUndefined();
    const sale = await read((tx) => tx.sale.findUniqueOrThrow({ where: { id: r.saleId }, include: { items: true } }));
    expect([sale.subtotal, sale.discount, sale.total]).toEqual([9000, 0, 9000]);
    expect(sale.items.map((i) => [i.productName, i.quantity, i.unitPrice, i.unitCost, i.lineTotal]).sort()).toEqual([["A", 2, 2000, 1200, 4000], ["B", 1, 5000, 3000, 5000]]);
    expect([await stockOf(shop.id, a.id), await stockOf(shop.id, b.id)]).toEqual([8, 2]);
  });

  it("applies a percentage discount and calculates change", async () => {
    const r = await sell(cashier, input([{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 1 }], { discountType: "percent", discountValue: 10, amountPaid: 10000 }));
    const sale = await read((tx) => tx.sale.findUniqueOrThrow({ where: { id: r.saleId } }));
    expect([sale.discount, sale.total, sale.amountPaid, sale.changeGiven]).toEqual([900, 8100, 10000, 1900]);
  });

  it("enforces the cashier discount cap on the server, but not for managers", async () => {
    const items = [{ productId: a.id, quantity: 2 }];
    const tooMuch = input(items, { discountType: "percent", discountValue: 15 });
    expect((await sell(cashier, tooMuch)).error).toMatch(/at most 10%/);
    expect(await stockOf(shop.id, a.id)).toBe(10);
    expect((await sell(manager, tooMuch)).error).toBeUndefined();
    expect((await sell(cashier, input(items, { discountType: "percent", discountValue: 10 }))).error).toBeUndefined();
  });

  it("honours a changed cashier limit", async () => {
    const r = await sell(cashier, input([{ productId: a.id, quantity: 2 }], { discountType: "percent", discountValue: 15 }), { cashierMaxDiscountPercent: 20 });
    expect(r.error).toBeUndefined();
  });

  it("rejects a discount larger than the subtotal", async () => {
    expect((await sell(manager, input([{ productId: a.id, quantity: 1 }], { discountValue: 5000 }))).error).toMatch(/cannot exceed/);
  });

  it("requires enough cash, and ignores the tendered amount for non-cash payments", async () => {
    const items = [{ productId: a.id, quantity: 1 }];
    expect((await sell(cashier, input(items, { amountPaid: 1999 }))).error).toMatch(/less than the total/);
    const r = await sell(cashier, input(items, { paymentMethod: "MOBILE_MONEY", amountPaid: 1, reference: "MM1" }));
    const sale = await read((tx) => tx.sale.findUniqueOrThrow({ where: { id: r.saleId } }));
    expect([sale.amountPaid, sale.changeGiven, sale.note]).toEqual([2000, 0, "MM1"]);
  });

  it("rolls everything back when any line lacks stock", async () => {
    const r = await sell(cashier, input([{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 5 }]));
    expect(r.error).toMatch(/Not enough stock for "B"/);
    expect([await stockOf(shop.id, a.id), await stockOf(shop.id, b.id)]).toEqual([10, 3]);
    expect(await read((tx) => tx.sale.count())).toBe(0);
    expect(await read((tx) => tx.stockMovement.count())).toBe(0);
    expect(await read((tx) => tx.receiptCounter.count())).toBe(0); // even the receipt number isn't used up
  });

  it("checks duplicate lines against their combined quantity", async () => {
    const r = await sell(cashier, input([{ productId: a.id, quantity: 6 }, { productId: a.id, quantity: 6 }]));
    expect(r.error).toMatch(/Not enough stock/);
    expect(await stockOf(shop.id, a.id)).toBe(10);
  });

  it("refuses inactive and unknown products", async () => {
    const off = await makeProduct(shop.id, { isActive: false });
    expect((await sell(cashier, input([{ productId: off.id, quantity: 1 }]))).error).toMatch(/inactive/);
    expect((await sell(cashier, input([{ productId: "nope", quantity: 1 }]))).error).toMatch(/no longer exists/);
  });

  it("numbers receipts per shop and per Kampala day", async () => {
    const items = [{ productId: a.id, quantity: 1 }];
    const first = await sell(cashier, input(items), rules, new Date("2026-03-05T10:00:00Z"));
    const second = await sell(cashier, input(items), rules, new Date("2026-03-05T11:00:00Z"));
    const nextDay = await sell(cashier, input(items), rules, new Date("2026-03-05T22:30:00Z")); // already 6 Mar in Kampala
    expect([first.receiptNo, second.receiptNo, nextDay.receiptNo]).toEqual(["RCP-20260305-0001", "RCP-20260305-0002", "RCP-20260306-0001"]);
  });

  it("continues after receipts that predate the counter instead of colliding with them", async () => {
    const legacy = await sell(cashier, input([{ productId: a.id, quantity: 1 }]), rules, new Date("2026-05-01T10:00:00Z"));
    await read((tx) => tx.sale.update({ where: { id: legacy.saleId }, data: { receiptNo: "RCP-20260501-0457" } }));
    await read((tx) => tx.receiptCounter.deleteMany());
    const next = await sell(cashier, input([{ productId: a.id, quantity: 1 }]), rules, new Date("2026-05-01T11:00:00Z"));
    expect(next.receiptNo).toBe("RCP-20260501-0458");
  });

  it("records the stock movement against the receipt number", async () => {
    const r = await sell(cashier, input([{ productId: a.id, quantity: 4 }]));
    const m = await read((tx) => tx.stockMovement.findFirstOrThrow({ where: { productId: a.id } }));
    expect([m.type, m.quantity, m.stockAfter, m.reference, m.userId]).toEqual(["SALE", -4, 6, r.receiptNo, cashier.id]);
  });

  it("writes an activity-log entry in the same transaction as the sale", async () => {
    const r = await sell(cashier, input([{ productId: a.id, quantity: 1 }]));
    const log = await read((tx) => tx.auditLog.findFirstOrThrow({ where: { action: "sale.create" } }));
    expect([log.shopId, log.userId, log.entityId]).toEqual([shop.id, cashier.id, r.saleId]);
  });

  it("keeps historical prices when the product price changes later", async () => {
    const r = await sell(cashier, input([{ productId: a.id, quantity: 1 }]));
    await read((tx) => tx.product.update({ where: { id: a.id }, data: { sellPrice: 9999, costPrice: 8888 } }));
    const item = await read((tx) => tx.saleItem.findFirstOrThrow({ where: { saleId: r.saleId } }));
    expect([item.unitPrice, item.unitCost]).toEqual([2000, 1200]);
  });

  it("sells the last unit to only one of two simultaneous customers", async () => {
    const last = await makeProduct(shop.id, { stock: 1 });
    const results = await Promise.all([1, 2].map(() => sell(cashier, input([{ productId: last.id, quantity: 1 }]))));
    expect(results.filter((r) => r.saleId)).toHaveLength(1);
    expect(results.filter((r) => r.error)).toHaveLength(1);
    expect(await stockOf(shop.id, last.id)).toBe(0);
  });

  it("gives simultaneous sales distinct receipt numbers", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => sell(cashier, input([{ productId: a.id, quantity: 1 }]), rules, new Date("2026-04-01T10:00:00Z"))));
    expect(results.every((r) => r.saleId)).toBe(true);
    expect(new Set(results.map((r) => r.receiptNo)).size).toBe(6);
  });

  describe("with two shops", () => {
    it("cannot sell another shop's product, and leaves that shop's stock alone", async () => {
      const other = await makeShop("Other shop");
      const theirs = await makeProduct(other.id, { name: "Theirs", stock: 5 });
      const r = await sell(cashier, input([{ productId: theirs.id, quantity: 1 }]));
      expect(r.error).toMatch(/no longer exists/);
      expect(await stockOf(other.id, theirs.id)).toBe(5);
    });

    it("numbers receipts independently in each shop", async () => {
      const other = await makeShop("Other shop");
      const otherCashier = await makeUser(other.id, "CASHIER");
      const theirs = await makeProduct(other.id, { stock: 5 });
      const day = new Date("2026-06-01T10:00:00Z");
      const mine = await sell(cashier, input([{ productId: a.id, quantity: 1 }]), rules, day);
      const theirsSale = await sellInShop(other.id, otherCashier, input([{ productId: theirs.id, quantity: 1 }]), rules, day);
      expect([mine.receiptNo, theirsSale.receiptNo]).toEqual(["RCP-20260601-0001", "RCP-20260601-0001"]);
    });

    it("applies each shop's own cashier discount limit", async () => {
      const strict = await makeShop("Strict", { cashierMaxDiscountPercent: 2 });
      const c2 = await makeUser(strict.id, "CASHIER");
      const p = await makeProduct(strict.id, { price: 1000, stock: 5 });
      const r = await sellInShop(strict.id, c2, input([{ productId: p.id, quantity: 1 }], { discountType: "percent", discountValue: 5 }), { cashierMaxDiscountPercent: 2 });
      expect(r.error).toMatch(/at most 2%/);
    });
  });
});
