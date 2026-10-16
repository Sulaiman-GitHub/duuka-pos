/** Everything needed to print one receipt, as plain data (so the same receipt can be shown, browser-printed or sent to a thermal printer). */
export type ReceiptData = {
  shopName: string; address: string; phone: string; footer: string;
  /** Paper width of the shop's receipt printer in millimetres. */
  widthMm: 58 | 80;
  ref: string; refNote?: string; dateText: string; cashier: string; customer?: string; customerPhone?: string;
  lines: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number; discount: number; total: number;
  paymentLabel: string; paid: number; change: number; reference?: string;
  refunded?: number; status?: string; currency: string;
};

export const isReceiptWidth = (w: number): w is 58 | 80 => w === 58 || w === 80;
