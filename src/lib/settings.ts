import "server-only";
import { cache } from "react";
import { withShop } from "@/lib/tenant";

export type Settings = {
  name: string;
  address: string;
  phone: string;
  receiptFooter: string;
  cashierMaxDiscountPercent: number;
  currency: string;
  receiptWidth: 58 | 80;
};

/** A shop's settings (name, contact details, receipt footer, cashier discount limit). One read per request per shop. */
export const getSettings = cache(async (shopId: string): Promise<Settings> => {
  const s = await withShop(shopId, (tx) => tx.shop.findUniqueOrThrow({ where: { id: shopId } }));
  return { name: s.name, address: s.address, phone: s.phone, receiptFooter: s.receiptFooter, cashierMaxDiscountPercent: s.cashierMaxDiscountPercent, currency: s.currency, receiptWidth: s.receiptWidth === 58 ? 58 : 80 };
});
