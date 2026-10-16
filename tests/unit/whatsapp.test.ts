import { describe, expect, it } from "vitest";
import { normalizePhone, receiptToText, whatsappLink } from "@/lib/whatsapp";
import type { ReceiptData } from "@/lib/printing/types";

describe("phone numbers for WhatsApp", () => {
  it("turns local Ugandan numbers into international form", () => {
    expect(normalizePhone("0772 123 456")).toBe("256772123456");
    expect(normalizePhone("0748728735", "UGX")).toBe("256748728735");
    expect(normalizePhone("772123456")).toBe("256772123456");
  });
  it("keeps numbers that already have a country code, with or without + or 00", () => {
    expect(normalizePhone("+256 748 728 735")).toBe("256748728735");
    expect(normalizePhone("00256748728735")).toBe("256748728735");
    expect(normalizePhone("256748728735")).toBe("256748728735");
    expect(normalizePhone("+44 7700 900123")).toBe("447700900123");
  });
  it("uses the shop's country", () => {
    expect(normalizePhone("0712345678", "KES")).toBe("254712345678");
    expect(normalizePhone("0712345678", "TZS")).toBe("255712345678");
  });
  it("rejects things that can't be a phone number", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
  });
});

const receipt: ReceiptData = {
  shopName: "Duuka Mart", address: "Kansanga, Kampala", phone: "+256748728735", footer: "Thank you!", widthMm: 80, ref: "RCP-1", dateText: "16 Oct 2026, 10:00",
  cashier: "Peter", currency: "UGX", lines: [{ name: "Milk 1L", quantity: 2, unitPrice: 3500, lineTotal: 7000 }], subtotal: 7000, discount: 500, total: 6500,
  paymentLabel: "Cash", paid: 10000, change: 3500,
};

describe("receipt as a WhatsApp message", () => {
  it("contains what the customer needs", () => {
    const t = receiptToText(receipt);
    for (const s of ["*Duuka Mart*", "Receipt: RCP-1", "2 × Milk 1L — UGX 7,000", "Discount: -UGX 500", "*TOTAL: UGX 6,500*", "Change: UGX 3,500", "Thank you!"]) expect(t).toContain(s);
  });
  it("flags a provisional receipt and leaves out empty parts", () => {
    const t = receiptToText({ ...receipt, refNote: "PROVISIONAL - final number follows", discount: 0, change: 0 });
    expect(t).toContain("PROVISIONAL");
    expect(t).not.toContain("Discount");
    expect(t).not.toContain("Change");
  });
  it("builds a link that survives special characters", () => {
    const link = whatsappLink("256748728735", "Total: 6,500 & more\nline 2");
    expect(link.startsWith("https://wa.me/256748728735?text=")).toBe(true);
    expect(decodeURIComponent(link.split("?text=")[1])).toBe("Total: 6,500 & more\nline 2");
    expect(whatsappLink(null, "hi")).toBe("https://wa.me/?text=hi");
  });
});
