"use client";

import { useEffect } from "react";

const KEY = "duuka-till-saved";
const HOURS_BETWEEN = 12;

/**
 * For anyone who can sell: after signing in, from whichever screen they land on, ask the service worker to save the
 * till on this device. That way the till opens offline even if they have never opened it while online. Repeats at most
 * every 12 hours (it re-downloads the till page), and again after a new sign-in.
 */
export function OfflineWarm() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    try {
      const last = Number(localStorage.getItem(KEY) ?? 0);
      if (Date.now() - last < HOURS_BETWEEN * 3600_000) return;
    } catch { /* storage blocked: just try */ }
    let cancelled = false;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "warmed" && e.data.ok) { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    navigator.serviceWorker.ready.then((reg) => {
      if (cancelled) return;
      const urls = performance.getEntriesByType("resource").map((r) => r.name).filter((n) => n.includes("/_next/static/") || n.includes("/icons/"));
      reg.active?.postMessage({ type: "warm", urls });
    }).catch(() => {});
    return () => { cancelled = true; navigator.serviceWorker.removeEventListener("message", onMessage); };
  }, []);
  return null;
}
