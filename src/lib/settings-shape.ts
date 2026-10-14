export type Settings = {
  name: string;
  address: string;
  phone: string;
  receiptFooter: string;
  cashierMaxDiscountPercent: number;
  currency: string;
  receiptWidth: 58 | 80;
};

type ShopRow = { name: string; address: string; phone: string; receiptFooter: string; cashierMaxDiscountPercent: number; currency: string; receiptWidth: number };

export const toSettings = (s: ShopRow): Settings => ({
  name: s.name, address: s.address, phone: s.phone, receiptFooter: s.receiptFooter,
  cashierMaxDiscountPercent: s.cashierMaxDiscountPercent, currency: s.currency, receiptWidth: s.receiptWidth === 58 ? 58 : 80,
});
