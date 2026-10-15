import { describe, expect, it } from "vitest";
import { productImageUrl } from "@/lib/product-image-url";

describe("product image address", () => {
  it("changes when the photo's version changes, and is stable otherwise", () => {
    const a = new Date("2026-10-19T10:00:00Z"), b = new Date("2026-10-19T10:00:01Z");
    expect(productImageUrl("p1", a)).toBe(productImageUrl("p1", new Date(a)));
    expect(productImageUrl("p1", a)).not.toBe(productImageUrl("p1", b));
    expect(productImageUrl("p1", a)).toBe(`/api/products/p1/image?v=${a.getTime()}`);
  });
  it("accepts a stored timestamp (number or ISO text) and treats a missing version as 0", () => {
    const t = Date.UTC(2026, 9, 19);
    expect(productImageUrl("p1", t)).toBe(productImageUrl("p1", new Date(t)));
    expect(productImageUrl("p1", new Date(t).toISOString())).toBe(productImageUrl("p1", t));
    expect(productImageUrl("p1", null)).toBe("/api/products/p1/image?v=0");
  });
});
