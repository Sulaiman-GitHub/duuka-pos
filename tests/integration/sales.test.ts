import { beforeEach, describe, expect, it } from "vitest";
import { createSale, type SaleInput } from "@/lib/sales";
import { dbAvailable, makeProduct, makeUser, resetDb, stockOf, testDb } from "../helpers/db";

const up = await dbAvailable();
const rules = { cashierMaxDiscountPercent: 10 };
const input = (items: SaleInput["items"], o: Partial<SaleInput> = {}): SaleInput => ({ items, discountType: "amount", discountValue: 0, paymentMethod: "CASH", amountPaid: 100000, ...o });

describe.skipIf(!up)("completing a sale", () => {
  let cashier: Awaited<ReturnType<typeof makeUser>>, manager: Awaited<ReturnType<typeof makeUser>>;
  let a: Awaited<ReturnType<typeof makeProduct>>, b: Awaited<ReturnType<typeof makeProduct>>;

  beforeEach(async () => {
    await resetDb();
    cashier = await makeUser("CASHIER"); manager = await makeUser("MANAGER");
    a = await makeProduct({ name: "A", price: 2000, cost: 1200, stock: 10 });
    b = await makeProduct({ name: "B", price: 5000, cost: 3000, stock: 3 });
  });

  it("prices the sale from the database and deducts stock", async () => {
    const r = await createSale(testDb, cashier, input([{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 1 }]), rules);
    expect(r.error).toBeUndefined();
    const sale = await testDb.sale.findUniqueOrThrow({ where: { id: r.saleId }, include: { items: true } });
    expect([sale.subtotal, sale.discount, sale.total]).toEqual([9000, 0, 9000]);
    expect(sale.items.map((i) => [i.productName, i.quantity, i.unitPrice, i.unitCost, i.lineTotal]).sort()).toEqual([["A", 2, 2000, 1200, 4000], ["B", 1, 5000, 3000, 5000]]);
    expect([await stockOf(a.id), await stockOf(b.id)]).toEqual([8, 2]);
  });

  it("applies a percentage discount and calculates change", async () => {
    const r = await createSale(testDb, cashier, input([{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 1 }], { discountType: "percent", discountValue: 10, amountPaid: 10000 }), rules);
    const sale = await testDb.sale.findUniqueOrThrow({ where: { id: r.saleId } });
    expect([sale.discount, sale.total, sale.amountPaid, sale.changeGiven]).toEqual([900, 8100, 10000, 1900]);
  });

  it("enforces the cashier discount cap on the server, but not for managers", async () => {
    const items = [{ productId: a.id, quantity: 2 }];
    const tooMuch = input(items, { discountType: "percent", discountValue: 15 });
    expect((await createSale(testDb, cashier, tooMuch, rules)).error).toMatch(/at most 10%/);
    expect(await stockOf(a.id)).toBe(10); // rejected before anything changed
    expect((await createSale(testDb, manager, tooMuch, rules)).error).toBeUndefined();
    expect((await createSale(testDb, cashier, input(items, { discountType: "percent", discountValue: 10 }), rules)).error).toBeUndefined();
  });

  it("honours a changed cashier limit", async () => {
    const r = await createSale(testDb, cashier, input([{ productId: a.id, quantity: 2 }], { discountType: "percent", discountValue: 15 }), { cashierMaxDiscountPercent: 20 });
    expect(r.error).toBeUndefined();
  });

  it("rejects a discount larger than the subtotal", async () => {
    expect((await createSale(testDb, manager, input([{ productId: a.id, quantity: 1 }], { discountValue: 5000 }), rules)).error).toMatch(/cannot exceed/);
  });

  it("requires enough cash, and ignores the tendered amount for non-cash payments", async () => {
    const items = [{ productId: a.id, quantity: 1 }];
    expect((await createSale(testDb, cashier, input(items, { amountPaid: 1999 }), rules)).error).toMatch(/less than the total/);
    const r = await createSale(testDb, cashier, input(items, { paymentMethod: "MOBILE_MONEY", amountPaid: 1, reference: "MM1" }), rules);
    const sale = await testDb.sale.findUniqueOrThrow({ where: { id: r.saleId } });
    expect([sale.amountPaid, sale.changeGiven, sale.note]).toEqual([2000, 0, "MM1"]);
  });

  it("rolls back everything when any line lacks stock", async () => {
    const r = await createSale(testDb, cashier, input([{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 5 }]), rules);
    expect(r.error).toMatch(/Not enough stock for "B"/);
    expect([await stockOf(a.id), await stockOf(b.id)]).toEqual([10, 3]);
    expect(await testDb.sale.count()).toBe(0);
    expect(await testDb.stockMovement.count()).toBe(0);
  });

  it("checks duplicate lines against their combined quantity", async () => {
    const r = await createSale(testDb, cashier, input([{ productId: a.id, quantity: 6 }, { productId: a.id, quantity: 6 }]), rules);
    expect(r.error).toMatch(/Not enough stock/);
    expect(await stockOf(a.id)).toBe(10);
  });

  it("refuses inactive and unknown products", async () => {
    const off = await makeProduct({ isActive: false });
    expect((await createSale(testDb, cashier, input([{ productId: off.id, quantity: 1 }]), rules)).error).toMatch(/inactive/);
    expect((await createSale(testDb, cashier, input([{ productId: "nope", quantity: 1 }]), rules)).error).toMatch(/no longer exists/);
  });

  it("numbers receipts per Kampala day", async () => {
    const items = [{ productId: a.id, quantity: 1 }];
    const first = await createSale(testDb, cashier, input(items), rules, new Date("2026-03-05T10:00:00Z"));
    const second = await createSale(testDb, cashier, input(items), rules, new Date("2026-03-05T11:00:00Z"));
    const nextDay = await createSale(testDb, cashier, input(items), rules, new Date("2026-03-05T22:30:00Z")); // already 6 Mar in Kampala
    expect([first.receiptNo, second.receiptNo, nextDay.receiptNo]).toEqual(["RCP-20260305-0001", "RCP-20260305-0002", "RCP-20260306-0001"]);
  });

  it("continues after receipts that predate the counter instead of colliding with them", async () => {
    const legacy = await createSale(testDb, cashier, input([{ productId: a.id, quantity: 1 }]), rules, new Date("2026-05-01T10:00:00Z"));
    await testDb.sale.update({ where: { id: legacy.saleId }, data: { receiptNo: "RCP-20260501-0457" } }); // as if created by an older version
    await testDb.receiptCounter.deleteMany();
    const next = await createSale(testDb, cashier, input([{ productId: a.id, quantity: 1 }]), rules, new Date("2026-05-01T11:00:00Z"));
    expect(next.receiptNo).toBe("RCP-20260501-0458");
  });

  it("records the stock movement against the receipt number", async () => {
    const r = await createSale(testDb, cashier, input([{ productId: a.id, quantity: 4 }]), rules);
    const m = await testDb.stockMovement.findFirstOrThrow({ where: { productId: a.id } });
    expect([m.type, m.quantity, m.stockAfter, m.reference, m.userId]).toEqual(["SALE", -4, 6, r.receiptNo, cashier.id]);
  });

  it("keeps historical prices when the product price changes later", async () => {
    const r = await createSale(testDb, cashier, input([{ productId: a.id, quantity: 1 }]), rules);
    await testDb.product.update({ where: { id: a.id }, data: { sellPrice: 9999, costPrice: 8888 } });
    const item = await testDb.saleItem.findFirstOrThrow({ where: { saleId: r.saleId } });
    expect([item.unitPrice, item.unitCost]).toEqual([2000, 1200]);
  });

  it("sells the last unit to only one of two simultaneous customers", async () => {
    const last = await makeProduct({ stock: 1 });
    const results = await Promise.all([1, 2].map(() => createSale(testDb, cashier, input([{ productId: last.id, quantity: 1 }]), rules)));
    expect(results.filter((r) => r.saleId)).toHaveLength(1);
    expect(results.filter((r) => r.error)).toHaveLength(1);
    expect(await stockOf(last.id)).toBe(0);
  });

  it("gives simultaneous sales distinct receipt numbers", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => createSale(testDb, cashier, input([{ productId: a.id, quantity: 1 }]), rules, new Date("2026-04-01T10:00:00Z"))));
    expect(results.every((r) => r.saleId)).toBe(true);
    expect(new Set(results.map((r) => r.receiptNo)).size).toBe(6);
  });
});
