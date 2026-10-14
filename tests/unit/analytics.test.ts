import { describe, expect, it } from "vitest";
import { bucketOf, daysBetween, groupByGrain, net, sumFacts, type SaleFact } from "@/lib/analytics";

const fact = (o: Partial<SaleFact>): SaleFact => ({ id: "x", at: new Date(), day: "2026-10-06", total: 0, discount: 0, refunded: 0, cogs: 0, method: "CASH", cashierId: "c", ...o });

describe("money definitions", () => {
  it("net sales = total - refunds; gross profit = net - cost of goods", () => {
    const t = sumFacts([fact({ total: 8100, discount: 900, refunded: 1800, cogs: 4200 }), fact({ total: 1000, cogs: 600 })]);
    expect(t).toEqual({ transactions: 2, gross: 9100, refunds: 1800, net: 7300, cogs: 4800, profit: 2500, discount: 900 });
    expect(net(fact({ total: 500, refunded: 200 }))).toBe(300);
  });

  it("handles an empty period", () => {
    expect(sumFacts([])).toEqual({ transactions: 0, gross: 0, refunds: 0, net: 0, cogs: 0, profit: 0, discount: 0 });
  });
});

describe("period bucketing", () => {
  it("starts weeks on Monday", () => {
    expect(bucketOf("2026-10-07", "week").key).toBe("2026-10-05"); // Wednesday
    expect(bucketOf("2026-10-05", "week").key).toBe("2026-10-05"); // Monday itself
    expect(bucketOf("2026-10-11", "week").key).toBe("2026-10-05"); // Sunday belongs to the previous Monday
    expect(bucketOf("2026-10-12", "week").key).toBe("2026-10-12");
  });
  it("groups by month and day", () => {
    expect(bucketOf("2026-10-31", "month").key).toBe("2026-10");
    expect(bucketOf("2026-10-31", "day").key).toBe("2026-10-31");
  });
  it("lists every day in a range", () => {
    const from = new Date("2026-10-04T21:00:00Z"); // 5 Oct Kampala
    expect(daysBetween(from, new Date("2026-10-07T21:00:00Z"))).toEqual(["2026-10-05", "2026-10-06", "2026-10-07"]);
  });
  it("zero-fills quiet days so charts and tables have no gaps", () => {
    const from = new Date("2026-10-04T21:00:00Z"), to = new Date("2026-10-07T21:00:00Z");
    const rows = groupByGrain([fact({ day: "2026-10-06", total: 500 })], from, to, "day");
    expect(rows.map((r) => [r.key, r.net])).toEqual([["2026-10-05", 0], ["2026-10-06", 500], ["2026-10-07", 0]]);
  });
});
