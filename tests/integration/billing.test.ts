import { beforeEach, describe, expect, it } from "vitest";
import { assertCanAddUser, createInvoice, markInvoicePaid, PlanLimitError, voidInvoice } from "@/lib/billing";
import { dbAvailable, makeShop, makeUser, resetDb, asPlatform, withShop } from "../helpers/db";

const up = await dbAvailable();
const price = (shopId: string, monthlyPrice = 30000, extra: Record<string, unknown> = {}) => asPlatform((tx) => tx.shop.update({ where: { id: shopId }, data: { monthlyPrice, planName: "Standard", ...extra } }));
const now = new Date("2026-10-18T09:00:00+03:00");

describe.skipIf(!up)("manual invoicing", () => {
  beforeEach(resetDb);

  it("numbers invoices sequentially, and concurrently issued ones never share a number", async () => {
    const a = await makeShop(); const b = await makeShop(); await price(a.id); await price(b.id);
    const i1 = await asPlatform((tx) => createInvoice(tx, a.id, { months: 1 }, now));
    const rest = await Promise.all([a.id, b.id, a.id].map((id) => asPlatform((tx) => createInvoice(tx, id, { months: 1 }, now))));
    const numbers = [i1, ...rest].map((i) => i.number);
    expect(i1.number).toBe("INV-2026-0001");
    expect(new Set(numbers).size).toBe(4);
  });

  it("bills the next unbilled period: invoices never overlap, and the amount defaults to months × price", async () => {
    const shop = await makeShop(); await price(shop.id, 30000);
    const first = await asPlatform((tx) => createInvoice(tx, shop.id, { months: 1 }, now));
    const second = await asPlatform((tx) => createInvoice(tx, shop.id, { months: 3 }, now));
    expect(first.amount).toBe(30000); expect(second.amount).toBe(90000);
    expect(first.periodStart.toISOString()).toBe("2026-10-17T21:00:00.000Z"); // 18 Oct, Kampala
    expect(second.periodStart.getTime()).toBe(first.periodEnd.getTime() + 1); // starts exactly where the first ended
    expect(first.currency).toBe("UGX");
  });

  it("the first invoice starts after a running free trial, so trial days are never billed", async () => {
    const shop = await makeShop(); await price(shop.id, 30000, { trialEndsAt: new Date("2026-10-27T23:59:59.999+03:00") });
    const inv = await asPlatform((tx) => createInvoice(tx, shop.id, { months: 1 }, now));
    expect(inv.periodStart.toISOString()).toBe("2026-10-27T21:00:00.000Z"); // 28 Oct 00:00 Kampala
  });

  it("recording a payment extends cover to the end of the period, once", async () => {
    const shop = await makeShop(); await price(shop.id);
    const inv = await asPlatform((tx) => createInvoice(tx, shop.id, { months: 1 }, now));
    await asPlatform((tx) => markInvoicePaid(tx, inv.id, { method: "Mobile Money", reference: "MP123" }));
    const paid = await asPlatform((tx) => tx.shop.findUniqueOrThrow({ where: { id: shop.id } }));
    expect(paid.paidUntil?.getTime()).toBe(inv.periodEnd.getTime());
    await expect(asPlatform((tx) => markInvoicePaid(tx, inv.id, { method: "Cash" }))).rejects.toThrow(/already paid/);
    const row = await asPlatform((tx) => tx.invoice.findUniqueOrThrow({ where: { id: inv.id } }));
    expect([row.status, row.paymentMethod, row.paymentReference]).toEqual(["PAID", "Mobile Money", "MP123"]);
  });

  it("paying an older invoice never shortens cover that a later one already gave", async () => {
    const shop = await makeShop(); await price(shop.id);
    const a = await asPlatform((tx) => createInvoice(tx, shop.id, { months: 1 }, now));
    const b = await asPlatform((tx) => createInvoice(tx, shop.id, { months: 1 }, now));
    await asPlatform((tx) => markInvoicePaid(tx, b.id, { method: "Bank" }));
    await asPlatform((tx) => markInvoicePaid(tx, a.id, { method: "Bank" }));
    expect((await asPlatform((tx) => tx.shop.findUniqueOrThrow({ where: { id: shop.id } }))).paidUntil?.getTime()).toBe(b.periodEnd.getTime());
  });

  it("two people marking the same invoice paid at once records one payment", async () => {
    const shop = await makeShop(); await price(shop.id);
    const inv = await asPlatform((tx) => createInvoice(tx, shop.id, { months: 1 }, now));
    const rs = await Promise.allSettled([1, 2, 3].map(() => asPlatform((tx) => markInvoicePaid(tx, inv.id, { method: "Cash" }))));
    expect(rs.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("only unpaid invoices can be cancelled; refuses to invoice a shop with no price", async () => {
    const shop = await makeShop();
    await expect(asPlatform((tx) => createInvoice(tx, shop.id, { months: 1 }, now))).rejects.toThrow(/monthly price/);
    await price(shop.id);
    const inv = await asPlatform((tx) => createInvoice(tx, shop.id, { months: 1 }, now));
    await asPlatform((tx) => voidInvoice(tx, inv.id));
    await expect(asPlatform((tx) => voidInvoice(tx, inv.id))).rejects.toThrow();
    const paid = await asPlatform((tx) => createInvoice(tx, shop.id, { months: 1 }, now));
    await asPlatform((tx) => markInvoicePaid(tx, paid.id, { method: "Cash" }));
    await expect(asPlatform((tx) => voidInvoice(tx, paid.id))).rejects.toThrow();
  });

  it("a shop can read only its own invoices and can never write one", async () => {
    const a = await makeShop(); const b = await makeShop(); await price(a.id); await price(b.id);
    const ia = await asPlatform((tx) => createInvoice(tx, a.id, { months: 1 }, now));
    await asPlatform((tx) => createInvoice(tx, b.id, { months: 1 }, now));
    const seen = await withShop(a.id, (tx) => tx.invoice.findMany());
    expect(seen.map((i) => i.id)).toEqual([ia.id]);
    await expect(withShop(a.id, (tx) => tx.invoice.updateMany({ data: { amount: 1 } }))).resolves.toMatchObject({ count: 0 }); // RLS hides it from writes
    await expect(withShop(a.id, (tx) => tx.invoice.create({ data: { shopId: a.id, number: "X", description: "x", periodStart: now, periodEnd: now, amount: 1, currency: "UGX", dueDate: now } }))).rejects.toThrow();
    await expect(withShop(a.id, (tx) => tx.platformSettings.findMany())).resolves.toEqual([]);
  });

  it("enforces the plan's staff limit on active accounts", async () => {
    const shop = await makeShop(); await price(shop.id, 30000, { maxUsers: 2 });
    await makeUser(shop.id, "ADMIN"); await makeUser(shop.id, "CASHIER");
    await expect(withShop(shop.id, (tx) => assertCanAddUser(tx, shop.id))).rejects.toBeInstanceOf(PlanLimitError);
    await price(shop.id, 30000, { maxUsers: 3 });
    await expect(withShop(shop.id, (tx) => assertCanAddUser(tx, shop.id))).resolves.toBeUndefined();
  });
});
