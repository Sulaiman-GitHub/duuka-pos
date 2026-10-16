export type PosProduct = { id: string; name: string; sku: string; barcode: string | null; sellPrice: number; stock: number; categoryId: string | null; hasImage: boolean; imageV?: number; expiry?: string | null };

export type PosCatalog = {
  shopId: string; shopName: string; address: string; phone: string; receiptFooter: string; currency: string; receiptWidth: 58 | 80; expiryAlertDays?: number;
  userId: string; userName: string; canUploadAll: boolean; generatedAt: string; maxDiscountPercent: number;
  products: PosProduct[]; categories: { id: string; name: string }[];
};

export type SalePayload = {
  clientId: string; mode: "live" | "offline";
  items: { productId: string; quantity: number }[];
  discountType: "amount" | "percent"; discountValue: number;
  paymentMethod: "CASH" | "MOBILE_MONEY" | "CARD" | "BANK_TRANSFER"; amountPaid: number;
  customerName?: string; customerPhone?: string; reference?: string;
  cashierId?: string; offlineAt?: string; catalogAt?: string; expectedTotal?: number; prices?: Record<string, number>;
};

/** What the till shows on its own receipt for a sale that hasn't been uploaded yet. */
export type LocalReceipt = {
  lines: { name: string; quantity: number; unitPrice: number }[];
  subtotal: number; discount: number; total: number; paid: number; change: number; methodLabel: string;
  cashierName: string; customerName?: string; customerPhone?: string;
};

export type QueuedSale = {
  clientId: string; shopId: string; status: "pending" | "failed"; error?: string; createdAt: string; attempts: number;
  payload: SalePayload; receipt: LocalReceipt;
};
