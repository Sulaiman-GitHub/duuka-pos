import { describe, expect, it } from "vitest";
import { addDays, kampalaDateString, parseKampalaDate, startOfKampalaDay } from "@/lib/time";

describe("Kampala day boundaries (UTC+3)", () => {
  it("rolls to the next local day at 21:00 UTC", () => {
    expect(kampalaDateString(new Date("2026-10-06T20:59:59Z"))).toBe("2026-10-06");
    expect(kampalaDateString(new Date("2026-10-06T21:00:00Z"))).toBe("2026-10-07");
  });

  it("finds the UTC instant a Kampala day starts", () => {
    expect(startOfKampalaDay(new Date("2026-10-06T10:00:00Z")).toISOString()).toBe("2026-10-05T21:00:00.000Z");
    expect(startOfKampalaDay(new Date("2026-10-06T22:00:00Z")).toISOString()).toBe("2026-10-06T21:00:00.000Z");
  });

  it("parses date strings and rejects bad ones", () => {
    expect(parseKampalaDate("2026-10-06")?.toISOString()).toBe("2026-10-05T21:00:00.000Z");
    expect(parseKampalaDate("2026-13-45")).toBeNull();
    expect(parseKampalaDate("06/10/2026")).toBeNull();
    expect(parseKampalaDate("")).toBeNull();
    expect(parseKampalaDate(undefined)).toBeNull();
  });

  it("adds whole days", () => {
    expect(addDays(new Date("2026-01-01T00:00:00Z"), 3).toISOString()).toBe("2026-01-04T00:00:00.000Z");
  });
});
