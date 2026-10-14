import { describe, expect, it } from "vitest";
import { charsPerLine, receiptToEscPos, toPrinterText } from "@/lib/printing/escpos";
import type { ReceiptData } from "@/lib/printing/types";

const base: ReceiptData = {
  shopName: "Duuka Mart", address: "Kansanga, Kampala", phone: "+256748728735", footer: "Thank you for shopping with us!", widthMm: 58,
  ref: "RCP-20261017-0001", dateText: "17 Oct 2026, 10:15", cashier: "Peter", currency: "UGX",
  lines: [{ name: "Fresh Milk 1L", quantity: 2, unitPrice: 3500, lineTotal: 7000 }, { name: "A very long product name that cannot possibly fit on a single narrow line", quantity: 1, unitPrice: 12000, lineTotal: 12000 }],
  subtotal: 19000, discount: 1000, total: 18000, paymentLabel: "Cash", paid: 20000, change: 2000,
};
// Reads the printed text back out of the byte stream, skipping the printer commands we emit.
function asText(b: Uint8Array) {
  const skip: Record<number, Record<number, number>> = { 0x1b: { 0x40: 2, 0x61: 3, 0x45: 3, 0x64: 3 }, 0x1d: { 0x21: 3, 0x56: 4 } };
  let out = "";
  for (let i = 0; i < b.length; ) {
    const n = b[i] === 0x1b || b[i] === 0x1d ? skip[b[i]][b[i + 1]] : undefined;
    if (n) { i += n; continue; }
    out += b[i] === 10 ? "\n" : String.fromCharCode(b[i]);
    i++;
  }
  return out;
}

describe("ESC/POS receipt", () => {
  it("starts with the printer reset and ends with a feed and cut", () => {
    const b = receiptToEscPos(base);
    expect(Array.from(b.slice(0, 2))).toEqual([0x1b, 0x40]);
    expect(Array.from(b.slice(-4))).toEqual([0x1d, 0x56, 0x42, 0x00]);
  });

  it("never prints a line wider than the paper (58 mm = 32 chars, 80 mm = 48)", () => {
    for (const widthMm of [58, 80] as const) {
      const text = asText(receiptToEscPos({ ...base, widthMm }));
      const max = Math.max(...text.split("\n").map((l) => l.length));
      expect(max).toBeLessThanOrEqual(charsPerLine(widthMm));
    }
  });

  it("contains the amounts a customer expects to see", () => {
    const t = asText(receiptToEscPos(base));
    expect(t).toContain("UGX 18,000");
    expect(t).toContain("2 x 3,500");
    expect(t).toContain("Change");
    expect(t).toContain("Discount");
    expect(t).toContain("Thank you for shopping with us!");
  });

  it("only sends plain ASCII text (printers don't understand Unicode)", () => {
    expect(toPrinterText("Café − 2 × “x” …")).toBe('Cafe - 2 x "x" ...');
    expect(toPrinterText("日本")).toBe("??");
    const bytes = receiptToEscPos({ ...base, shopName: "Duuka — Café", customer: "Zoë" });
    expect(Array.from(bytes).every((b) => b < 0x80)).toBe(true);
  });
});
