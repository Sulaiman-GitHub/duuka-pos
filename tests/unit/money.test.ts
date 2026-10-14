import { describe, expect, it } from "vitest";
import { CURRENCIES, formatNumber, formatMoney, isCurrency, moneyFor } from "@/lib/money";

describe("money formatting", () => {
  it("formats whole shillings with thousands separators", () => {
    expect(formatMoney(0)).toBe("UGX 0");
    expect(formatMoney(1500)).toBe("UGX 1,500");
    expect(formatMoney(7976750)).toBe("UGX 7,976,750");
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("labels amounts with the shop's currency", () => {
    expect(formatMoney(2500, "KES")).toBe("KES 2,500");
    expect(moneyFor("RWF")(1000)).toBe("RWF 1,000");
    expect(Object.keys(CURRENCIES).every(isCurrency)).toBe(true);
    expect(isCurrency("USD")).toBe(false);
  });
});
