import { describe, expect, it } from "vitest";
import { expiryStatus, parseExpiryInput } from "@/lib/expiry";

const now = new Date("2026-10-16T10:00:00+03:00");
const day = (s: string) => parseExpiryInput(s)!;

describe("expiry status", () => {
  it("has no status for products that don't expire", () => {
    expect(expiryStatus(null, 30, now).state).toBe("none");
    expect(expiryStatus(undefined, 30, now).state).toBe("none");
  });
  it("is usable through its expiry day and expired the day after", () => {
    expect(expiryStatus(day("2026-10-16"), 30, now)).toMatchObject({ state: "soon", daysLeft: 0, label: "Expires today" });
    expect(expiryStatus(day("2026-10-15"), 30, now)).toMatchObject({ state: "expired", label: "Expired yesterday" });
    expect(expiryStatus(day("2026-10-10"), 30, now)).toMatchObject({ state: "expired", daysLeft: -6, label: "Expired 6 days ago" });
  });
  it("warns inside the alert window and not before it", () => {
    expect(expiryStatus(day("2026-11-15"), 30, now)).toMatchObject({ state: "soon", daysLeft: 30 });
    expect(expiryStatus(day("2026-11-16"), 30, now)).toMatchObject({ state: "ok", daysLeft: 31 });
    expect(expiryStatus(day("2026-10-17"), 30, now).label).toBe("Expires tomorrow");
    expect(expiryStatus(day("2026-10-26"), 30, now).label).toBe("Expires in 10 days");
  });
  it("uses the Kampala day, not the server's (UTC) day", () => {
    const lateEvening = new Date("2026-10-16T22:30:00+03:00"); // still the 16th in Kampala, already the 17th in some zones
    expect(expiryStatus(day("2026-10-16"), 30, lateEvening).state).toBe("soon");
    const justAfterMidnight = new Date("2026-10-17T00:30:00+03:00");
    expect(expiryStatus(day("2026-10-16"), 30, justAfterMidnight).state).toBe("expired");
  });
  it("reads dates typed into a form", () => {
    expect(parseExpiryInput("")).toBeNull();
    expect(parseExpiryInput("not a date")).toBeNull();
    expect(parseExpiryInput("2026-10-16")?.toISOString()).toBe("2026-10-15T21:00:00.000Z");
  });
});
