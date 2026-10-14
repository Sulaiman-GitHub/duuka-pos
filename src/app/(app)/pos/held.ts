"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export type HeldSale = {
  id: string;
  savedAt: number;
  cart: Record<string, number>;
  discountType: "amount" | "percent";
  discountValue: string;
  customerName: string;
  customerPhone: string;
};

const KEY = "duuka.heldSales";
const EVENT = "duuka:held-changed";

function read(): string {
  try { return window.localStorage.getItem(KEY) ?? "[]"; } catch { return "[]"; }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

/** Parked sales live in this browser only (localStorage), so each till keeps its own list. */
export function useHeldSales() {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  const held = useMemo<HeldSale[]>(() => { try { return JSON.parse(raw); } catch { return []; } }, [raw]);

  const write = useCallback((next: HeldSale[]) => {
    try { window.localStorage.setItem(KEY, JSON.stringify(next.slice(0, 20))); } catch { /* storage unavailable: parking is a convenience only */ }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const hold = useCallback((sale: Omit<HeldSale, "id" | "savedAt">) => write([{ ...sale, id: crypto.randomUUID(), savedAt: Date.now() }, ...held]), [held, write]);
  const remove = useCallback((id: string) => write(held.filter((h) => h.id !== id)), [held, write]);
  return { held, hold, remove };
}
