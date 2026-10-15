import type { QueuedSale } from "./types";

/**
 * Whose waiting sales this signed-in person may upload. A cashier uploads only their own, so a sale is never credited
 * to someone else on a shared device; a manager or admin may upload everyone's (the server records the real cashier).
 */
export const uploadableBy = (queue: QueuedSale[], me: { userId: string; canUploadAll: boolean }) =>
  queue.filter((q) => q.status === "pending" && (me.canUploadAll || q.payload.cashierId === me.userId));

/** The server's answer when an upload was refused only because of who is signed in (the sale stays waiting). */
export const NOT_YOURS = "NOT_YOURS";
