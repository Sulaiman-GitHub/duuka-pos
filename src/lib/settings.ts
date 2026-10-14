import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

// Defaults used until an admin saves the settings page (env vars can override them on the host).
export const DEFAULT_SETTINGS = {
  name: process.env.BUSINESS_NAME ?? "Duuka Mart",
  address: process.env.BUSINESS_ADDRESS ?? "Kansanga, Kampala, Uganda",
  phone: process.env.BUSINESS_PHONE ?? "+256 748 728 735 (Call / WhatsApp)",
  receiptFooter: process.env.RECEIPT_FOOTER ?? "Thank you for shopping with us!",
  cashierMaxDiscountPercent: 10,
};

export type Settings = typeof DEFAULT_SETTINGS;

/** Shop-wide settings, one DB read per request. */
export const getSettings = cache(async (): Promise<Settings> => {
  const row = await db.shopSettings.findUnique({ where: { id: "main" } }).catch(() => null);
  return row ? { name: row.name, address: row.address, phone: row.phone, receiptFooter: row.receiptFooter, cashierMaxDiscountPercent: row.cashierMaxDiscountPercent } : DEFAULT_SETTINGS;
});
