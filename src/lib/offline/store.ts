"use client";

import type { PosCatalog, QueuedSale } from "./types";

// A small IndexedDB wrapper: one `kv` store for the catalog, one `queue` store for sales waiting to be uploaded.
// The queue is only ever emptied by a successful upload (or an explicit discard), never by signing out.
const NAME = "duuka-offline";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("kv");
      db.createObjectStore("queue", { keyPath: "clientId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(store: "kv" | "queue", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const idbAvailable = () => typeof indexedDB !== "undefined";

export const getCatalog = (shopId: string) => run<PosCatalog | undefined>("kv", "readonly", (s) => s.get(`catalog:${shopId}`));
export const putCatalog = (c: PosCatalog) => run("kv", "readwrite", (s) => s.put(c, `catalog:${c.shopId}`));

export const queueSale = (q: QueuedSale) => run("queue", "readwrite", (s) => s.put(q));
export const removeQueued = (clientId: string) => run("queue", "readwrite", (s) => s.delete(clientId));
export async function listQueue(shopId: string): Promise<QueuedSale[]> {
  const all = await run<QueuedSale[]>("queue", "readonly", (s) => s.getAll());
  return all.filter((q) => q.shopId === shopId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
