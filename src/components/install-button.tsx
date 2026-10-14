"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/**
 * "Install app" for the sidebar. Chrome/Edge/Android offer a real install prompt; iPhone/iPad Safari has none, so we show
 * the two taps it needs. Hidden once the app is already installed (running standalone).
 */
export function InstallButton() {
  const [evt, setEvt] = useState<InstallEvent>();
  const [standalone, setStandalone] = useState(true); // assume installed until we know, so nothing flashes
  const [ios, setIos] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    // Reading browser-only facts after mount avoids a server/client mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStandalone(isStandalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    const onInstalled = () => { setStandalone(true); setEvt(undefined); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (standalone || (!evt && !ios)) return null;
  return (
    <div className="mb-2">
      <button
        onClick={async () => { if (evt) { await evt.prompt(); const c = await evt.userChoice; if (c.outcome === "accepted") setEvt(undefined); } else setHelp(!help); }}
        className="flex w-full items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700"
      >
        <Download size={16} /> Install app
      </button>
      {help && <p className="mt-2 rounded-lg bg-slate-800 p-2 text-xs text-slate-300">On iPhone/iPad: tap the <strong>Share</strong> button in Safari, then <strong>Add to Home Screen</strong>.</p>}
    </div>
  );
}
