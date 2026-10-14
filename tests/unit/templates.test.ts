import { describe, expect, it } from "vitest";
import { BUSINESS_TYPES, categoriesFor } from "@/lib/templates";

describe("business-type category templates", () => {
  it("has unique keys and at least one category each", () => {
    expect(new Set(BUSINESS_TYPES.map((t) => t.key)).size).toBe(BUSINESS_TYPES.length);
    for (const t of BUSINESS_TYPES) expect(t.categories.length, t.key).toBeGreaterThan(0);
  });
  it("returns the categories of the chosen types without duplicates", () => {
    const names = categoriesFor(["groceries", "electronics"]);
    expect(names).toContain("Beverages");
    expect(names).toContain("Batteries");
    expect(new Set(names).size).toBe(names.length);
  });
  it("ignores unknown keys and returns nothing for no choice", () => {
    expect(categoriesFor([])).toEqual([]);
    expect(categoriesFor(["nonsense"])).toEqual([]);
  });
});
