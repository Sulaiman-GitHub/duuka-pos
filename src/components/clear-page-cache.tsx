"use client";

import { useEffect } from "react";

/**
 * The sign-in page forgets the saved copy of the till page, so the next person to use this device never sees the last
 * person's screen. Sales waiting to upload are NOT touched: they stay on the device until they reach the server.
 */
export function ClearPageCache() {
  useEffect(() => {
    if (!("caches" in window)) return;
    caches.keys().then((keys) => keys.filter((k) => k.startsWith("duuka-pages")).forEach((k) => caches.delete(k))).catch(() => {});
  }, []);
  return null;
}
