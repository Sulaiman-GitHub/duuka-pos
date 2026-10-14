"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { flushQueue, retryFailed, type FlushOutcome } from "@/lib/offline/sync";
import { getCatalog, idbAvailable, listQueue, putCatalog, removeQueued } from "@/lib/offline/store";
import type { PosCatalog, PosProduct, QueuedSale } from "@/lib/offline/types";

/**
 * The till's connection to the shop's data, built to keep working with no internet:
 *  - the product list lives on the device (IndexedDB) and is refreshed whenever a connection is available;
 *  - sales made offline wait in a queue and are uploaded automatically when the connection returns;
 *  - stock on screen is the last known server stock minus what is still waiting in the queue.
 */
export function useTill(initial: PosCatalog) {
  const [catalog, setCatalog] = useState(initial);
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedSale[]>([]);
  const [signedOut, setSignedOut] = useState(false);
  const [lastSync, setLastSync] = useState<FlushOutcome>();
  const shopId = initial.shopId;

  const reloadQueue = useCallback(async () => { if (idbAvailable()) setQueue(await listQueue(shopId)); }, [shopId]);

  const refreshCatalog = useCallback(async () => {
    try {
      const res = await fetch("/api/pos/catalog", { cache: "no-store", signal: AbortSignal.timeout(10_000), redirect: "error" });
      if (res.status === 401) { setSignedOut(true); return; }
      if (!res.ok) return;
      const fresh = (await res.json()) as PosCatalog;
      if (fresh.shopId !== shopId) return;
      setCatalog(fresh);
      setSignedOut(false);
      if (idbAvailable()) await putCatalog(fresh).catch(() => {});
    } catch { /* offline: keep what we have */ }
  }, [shopId]);

  const sync = useCallback(async () => {
    if (!idbAvailable()) return;
    const out = await flushQueue(shopId);
    if (out.status === "signed-out") setSignedOut(true);
    if (out.status !== "busy") setLastSync(out);
    await reloadQueue();
    if (out.uploaded > 0) await refreshCatalog(); // stock changed on the server
  }, [shopId, reloadQueue, refreshCatalog]);

  // Start-up: prefer the device copy if it is newer than the page we were served from (the page itself may be a cached one).
  useEffect(() => {
    (async () => {
      if (idbAvailable()) {
        const saved = await getCatalog(shopId).catch(() => undefined);
        if (saved && saved.generatedAt > initial.generatedAt && saved.userId === initial.userId) setCatalog(saved);
        else await putCatalog(initial).catch(() => {});
        await reloadQueue();
      }
      // Ask the service worker to keep this page and its scripts for offline use.
      if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
        navigator.serviceWorker.ready.then((reg) => {
          const urls = performance.getEntriesByType("resource").map((r) => r.name).filter((n) => n.includes("/_next/static/") || n.includes("/icons/"));
          reg.active?.postMessage({ type: "warm", urls });
        }).catch(() => {});
      }
      await refreshCatalog();
      await sync();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connection monitoring: browser events plus a light heartbeat, because "connected to Wi-Fi" doesn't mean "has internet".
  useEffect(() => {
    let stop = false;
    const check = async () => {
      let ok = false;
      try { ok = (await fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(4000) })).ok; } catch { ok = false; }
      if (stop) return;
      setOnline((was) => {
        if (!was && ok) { void sync(); void refreshCatalog(); } // just came back
        return ok;
      });
    };
    const onOn = () => void check();
    const onOff = () => setOnline(false);
    window.addEventListener("online", onOn);
    window.addEventListener("offline", onOff);
    const id = setInterval(check, 15_000);
    void check();
    return () => { stop = true; clearInterval(id); window.removeEventListener("online", onOn); window.removeEventListener("offline", onOff); };
  }, [sync, refreshCatalog]);

  // Keep trying while sales are waiting.
  useEffect(() => {
    if (!online || !queue.some((q) => q.status === "pending")) return;
    const id = setInterval(() => void sync(), 30_000);
    return () => clearInterval(id);
  }, [online, queue, sync]);

  const pendingQty = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of queue) if (q.status === "pending") for (const it of q.payload.items) m.set(it.productId, (m.get(it.productId) ?? 0) + it.quantity);
    return m;
  }, [queue]);

  const products: PosProduct[] = useMemo(
    () => catalog.products.map((p) => (pendingQty.has(p.id) ? { ...p, stock: Math.max(0, p.stock - pendingQty.get(p.id)!) } : p)),
    [catalog.products, pendingQty],
  );

  const discard = useCallback(async (clientId: string) => { await removeQueued(clientId); await reloadQueue(); }, [reloadQueue]);
  const retry = useCallback(async (q: QueuedSale) => { await retryFailed(q); await reloadQueue(); void sync(); }, [reloadQueue, sync]);

  return { catalog, products, online, setOnline, queue, reloadQueue, sync, refreshCatalog, signedOut, lastSync, discard, retry };
}
