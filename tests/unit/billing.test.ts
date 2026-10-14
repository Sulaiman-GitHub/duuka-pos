import { describe, expect, it } from "vitest";
import { addMonthsKampala, billingStatus, needsAttention } from "@/lib/billing";

const now = new Date("2026-10-18T09:00:00+03:00");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);
const shop = (o: Partial<{ monthlyPrice: number; trialEndsAt: Date | null; paidUntil: Date | null }> = {}) => ({ monthlyPrice: 30000, trialEndsAt: null, paidUntil: null, ...o });

describe("billing status", () => {
  it("paid and comfortably covered", () => expect(billingStatus(shop({ paidUntil: days(20) }), now)).toMatchObject({ state: "paid", tone: "green" }));
  it("warns in the last 5 days of cover", () => {
    const s = billingStatus(shop({ paidUntil: days(3) }), now);
    expect(s).toMatchObject({ state: "due_soon", daysLeft: 3 });
    expect(needsAttention(s)).toBe(true);
  });
  it("overdue once the cover has ended", () => {
    const s = billingStatus(shop({ paidUntil: days(-4) }), now);
    expect(s).toMatchObject({ state: "overdue", daysOverdue: 4, tone: "red" });
    expect(s.label).toBe("Overdue by 4 days");
  });
  it("trial counts down, warns near the end, then shows as ended", () => {
    expect(billingStatus(shop({ trialEndsAt: days(20) }), now)).toMatchObject({ state: "trial", daysLeft: 20 });
    expect(billingStatus(shop({ trialEndsAt: days(2) }), now).state).toBe("due_soon");
    expect(billingStatus(shop({ trialEndsAt: days(-1) }), now)).toMatchObject({ state: "trial_ended", daysOverdue: 1 });
  });
  it("a paid shop is judged by its cover, not its old trial", () => {
    expect(billingStatus(shop({ trialEndsAt: days(-30), paidUntil: days(25) }), now).state).toBe("paid");
  });
  it("a shop with no trial and no price is simply free, and never nagged", () => {
    const s = billingStatus(shop({ monthlyPrice: 0 }), now);
    expect(s.state).toBe("free");
    expect(needsAttention(s)).toBe(false);
  });
});

describe("adding months in Kampala time", () => {
  it("keeps the day of month and clamps to the end of shorter months", () => {
    expect(addMonthsKampala(new Date("2026-10-18T10:00:00+03:00"), 1).toISOString()).toBe("2026-11-17T21:00:00.000Z"); // 18 Nov 00:00 Kampala
    expect(addMonthsKampala(new Date("2026-01-31T10:00:00+03:00"), 1).toISOString()).toBe("2026-02-27T21:00:00.000Z"); // 28 Feb
    expect(addMonthsKampala(new Date("2026-11-15T10:00:00+03:00"), 3).toISOString()).toBe("2027-02-14T21:00:00.000Z"); // 15 Feb
  });
});
