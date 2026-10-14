import { describe, expect, it } from "vitest";
import { formatNumber, formatUGX } from "@/lib/money";

describe("money formatting", () => {
  it("formats whole shillings with thousands separators", () => {
    expect(formatUGX(0)).toBe("UGX 0");
    expect(formatUGX(1500)).toBe("UGX 1,500");
    expect(formatUGX(7976750)).toBe("UGX 7,976,750");
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
});
