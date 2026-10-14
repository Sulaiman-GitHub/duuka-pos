"use client";

import { WifiOff } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Shown on every screen except the till (which has its own status bar) while there is no connection. Pages opened
 * offline are saved copies from the last time they were viewed, so they may be out of date.
 */
export function OfflineBanner({ canSell }: { canSell: boolean }) {
  const [offline, setOffline] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    let stop = false;
    const check = async () => {
      let ok = false;
      try { ok = (await fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(4000) })).ok; } catch { ok = false; }
      if (!stop) setOffline(!ok);
    };
    const id = setInterval(check, 15_000);
    window.addEventListener("online", check);
    window.addEventListener("offline", check);
    void check();
    return () => { stop = true; clearInterval(id); window.removeEventListener("online", check); window.removeEventListener("offline", check); };
  }, []);

  if (!offline || pathname.startsWith("/pos")) return null;
  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
      <WifiOff size={15} />
      <span className="font-medium">You&apos;re offline.</span>
      <span>What you see may be an older copy, and changes can&apos;t be saved until the connection is back.</span>
      {canSell && <Link href="/pos" className="font-medium underline">Go to the till — selling still works</Link>}
    </div>
  );
}
