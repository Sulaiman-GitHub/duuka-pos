import { beforeEach, describe, expect, it } from "vitest";
import { bestSellers, saleFacts, sumFacts } from "@/lib/analytics";
import { createReturn } from "@/lib/returns";
import { createSale } from "@/lib/sales";
import { addDays, startOfKampalaDay } from "@/lib/time";
import { dbAvailable, makeProduct, makeUser, resetDb, testDb } from "../helpers/db";

const up = await dbAvailable();

describe.skipIf(!up)("reporting figures (SQL)", () => {
  let mgr: Awaited<ReturnType<typeof makeUser>>;
  let a: Awaited<ReturnType<typeof makeProduct>>, b: Awaited<ReturnType<typeof makeProduct>>;
  const range = () => [startOfKampalaDay(), addDays(startOfKampalaDay(), 1)] as const;

  beforeEach(async () => {
    await resetDb();
    mgr = await makeUser("MANAGER");
    a = await makeProduct({ name: "A", price: 2000, cost: 1200, stock: 50 });
    b = await makeProduct({ name: "B", price: 5000, cost: 3000, stock: 50 });
  });

  async function sellAndPartlyRefund() {
    const r = await createSale(testDb, mgr, { items: [{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 1 }], discountType: "percent", discountValue: 10, paymentMethod: "CASH", amountPaid: 100000 }, { cashierMaxDiscountPercent: 10 });
    const itemA = (await testDb.saleItem.findFirstOrThrow({ where: { saleId: r.saleId, productId: a.id } })).id;
    await createReturn(testDb, mgr, { saleId: r.saleId!, reason: "test", restock: true, items: [{ saleItemId: itemA, quantity: 1 }] });
  }

  it("computes net sales and gross profit net of refunds and returned cost", async () => {
    await sellAndPartlyRefund();
    const facts = await saleFacts(...range());
    expect(facts).toHaveLength(1);
    // total 8,100; refunded 1,800 -> net 6,300; cost of goods kept = 1 x A (1,200) + 1 x B (3,000) = 4,200
    expect(sumFacts(facts)).toMatchObject({ transactions: 1, gross: 8100, discount: 900, refunds: 1800, net: 6300, cogs: 4200, profit: 2100 });
  });

  it("ranks best sellers by net units with revenue after discount, agreeing with the profit total", async () => {
    await sellAndPartlyRefund();
    const top = await bestSellers(...range());
    expect(top.map((p) => [p.name, p.units, p.revenue, p.profit])).toEqual([["B", 1, 4500, 1500], ["A", 1, 1800, 600]]); // equal units: higher revenue ranks first
    expect(top.reduce((s, p) => s + p.profit, 0)).toBe(sumFacts(await saleFacts(...range())).profit);
  });

  it("excludes sales outside the requested period", async () => {
    await sellAndPartlyRefund();
    const yesterday = [addDays(startOfKampalaDay(), -1), startOfKampalaDay()] as const;
    expect(await saleFacts(...yesterday)).toHaveLength(0);
    expect(await bestSellers(...yesterday)).toHaveLength(0);
  });
});
