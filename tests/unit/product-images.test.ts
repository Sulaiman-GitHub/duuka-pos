import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG } from "../../prisma/catalog";

const dir = path.resolve(__dirname, "../../prisma/product-images");
const manifest: Record<string, string> = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));

describe("demo product images", () => {
  const names = Object.values(CATALOG).flat().map(([name]) => name);

  it("has an illustration for every demo product, and none for products that don't exist", () => {
    expect(Object.keys(manifest).sort()).toEqual([...names].sort());
  });

  it("points at real JPEG files small enough for the 500 KB upload limit", () => {
    for (const file of Object.values(manifest)) {
      const bytes = fs.readFileSync(path.join(dir, file));
      expect([bytes[0], bytes[1], bytes[2]], file).toEqual([0xff, 0xd8, 0xff]);
      expect(bytes.length, file).toBeLessThan(500 * 1024);
    }
  });

  it("uses a different file for every product", () => {
    expect(new Set(Object.values(manifest)).size).toBe(names.length);
  });
});
