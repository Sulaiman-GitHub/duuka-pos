import { beforeEach, describe, expect, it } from "vitest";
import { bestSellers, saleFacts, sumFacts } from "@/lib/analytics";
import { returnInShop } from "@/lib/returns";
import { sellInShop } from "@/lib/sales";
import { addDays, startOfKampalaDay } from "@/lib/time";
import { dbAvailable, makeProduct, makeShop, makeUser, resetDb, withShop } from "../helpers/db";

const up = await dbAvailable();
const rules = { cashierMaxDiscountPercent: 10 };

describe.skipIf(!up)("reporting figures (SQL)", () => {
  let shop: Awaited<ReturnType<typeof makeShop>>, mgr: Awaited<ReturnType<typeof makeUser>>;
  let a: Awaited<ReturnType<typeof makeProduct>>, b: Awaited<ReturnType<typeof makeProduct>>;
  const range = () => [startOfKampalaDay(), addDays(startOfKampalaDay(), 1)] as const;
  const facts = (shopId = shop.id, r = range()) => withShop(shopId, (tx) => saleFacts(tx, ...r));
  const top = (shopId = shop.id, r = range()) => withShop(shopId, (tx) => bestSellers(tx, ...r));

  beforeEach(async () => {
    await resetDb();
    shop = await makeShop(); mgr = await makeUser(shop.id, "MANAGER");
    a = await makeProduct(shop.id, { name: "A", price: 2000, cost: 1200, stock: 50 });
    b = await makeProduct(shop.id, { name: "B", price: 5000, cost: 3000, stock: 50 });
  });

  async function sellAndPartlyRefund() {
    const r = await sellInShop(shop.id, mgr, { items: [{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 1 }], discountType: "percent", discountValue: 10, paymentMethod: "CASH", amountPaid: 100000 }, rules);
    const itemA = (await withShop(shop.id, (tx) => tx.saleItem.findFirstOrThrow({ where: { saleId: r.saleId, productId: a.id } }))).id;
    await returnInShop(shop.id, mgr, { saleId: r.saleId!, reason: "test", restock: true, items: [{ saleItemId: itemA, quantity: 1 }] });
  }

  it("computes net sales and gross profit net of refunds and returned cost", async () => {
    await sellAndPartlyRefund();
    const f = await facts();
    expect(f).toHaveLength(1);
    // total 8,100; refunded 1,800 -> net 6,300; cost of goods kept = 1 x A (1,200) + 1 x B (3,000) = 4,200
    expect(sumFacts(f)).toMatchObject({ transactions: 1, gross: 8100, discount: 900, refunds: 1800, net: 6300, cogs: 4200, profit: 2100 });
  });

  it("ranks best sellers by net units with revenue after discount, agreeing with the profit total", async () => {
    await sellAndPartlyRefund();
    const t = await top();
    expect(t.map((p) => [p.name, p.units, p.revenue, p.profit])).toEqual([["B", 1, 4500, 1500], ["A", 1, 1800, 600]]); // equal units: higher revenue ranks first
    expect(t.reduce((s, p) => s + p.profit, 0)).toBe(sumFacts(await facts()).profit);
  });

  it("excludes sales outside the requested period", async () => {
    await sellAndPartlyRefund();
    const yesterday = [addDays(startOfKampalaDay(), -1), startOfKampalaDay()] as const;
    expect(await facts(shop.id, yesterday)).toHaveLength(0);
    expect(await top(shop.id, yesterday)).toHaveLength(0);
  });

  it("never mixes in another shop's sales", async () => {
    await sellAndPartlyRefund();
    const other = await makeShop("Other"); const oc = await makeUser(other.id, "MANAGER");
    const p = await makeProduct(other.id, { name: "Theirs", price: 9000, cost: 1, stock: 10 });
    await sellInShop(other.id, oc, { items: [{ productId: p.id, quantity: 3 }], discountType: "amount", discountValue: 0, paymentMethod: "CASH", amountPaid: 100000 }, rules);
    expect(sumFacts(await facts()).gross).toBe(8100);
    expect(sumFacts(await facts(other.id)).gross).toBe(27000);
    expect((await top()).map((x) => x.name).sort()).toEqual(["A", "B"]);
    expect((await top(other.id)).map((x) => x.name)).toEqual(["Theirs"]);
  });
});
