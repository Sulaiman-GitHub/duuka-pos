"use client";

import { listQueue, queueSale, removeQueued } from "./store";
import type { QueuedSale } from "./types";

type Result = { clientId: string; error?: string; saleId?: string; receiptNo?: string; duplicate?: boolean; flagged?: string };
export type FlushOutcome = { uploaded: number; failed: number; status: "ok" | "offline" | "signed-out" | "busy" };

let flushing = false;

/**
 * Uploads every waiting sale for this shop, oldest first. Safe to call from anywhere, any number of times: the server
 * ignores a sale it already has, so a lost response just means the sale is confirmed as a duplicate next time.
 */
export async function flushQueue(shopId: string): Promise<FlushOutcome> {
  if (flushing) return { uploaded: 0, failed: 0, status: "busy" };
  flushing = true;
  try {
    const waiting = (await listQueue(shopId)).filter((q) => q.status === "pending");
    let uploaded = 0, failed = 0;
    for (let i = 0; i < waiting.length; i += 10) {
      const batch = waiting.slice(i, i + 10);
      let res: Response;
      try {
        res = await fetch("/api/sync/sales", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sales: batch.map((q) => q.payload) }),
          signal: AbortSignal.timeout(20_000), redirect: "error",
        });
      } catch {
        return { uploaded, failed, status: "offline" }; // no connection (or a redirect to the sign-in page): try again later
      }
      if (res.status === 401) return { uploaded, failed, status: "signed-out" };
      if (!res.ok) return { uploaded, failed, status: "offline" };
      const { results } = (await res.json()) as { results: Result[] };
      for (const r of results) {
        const q = batch.find((b) => b.clientId === r.clientId);
        if (!q) continue;
        if (r.error) {
          failed++;
          await queueSale({ ...q, status: "failed", error: r.error, attempts: q.attempts + 1 } satisfies QueuedSale);
        } else {
          uploaded++;
          await removeQueued(q.clientId);
        }
      }
    }
    return { uploaded, failed, status: "ok" };
  } finally {
    flushing = false;
  }
}

/** Puts a failed sale back in line (for example after a manager fixed the product it referred to). */
export const retryFailed = (q: QueuedSale) => queueSale({ ...q, status: "pending", error: undefined });
