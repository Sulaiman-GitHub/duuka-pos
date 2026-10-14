"use client";

import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import {
  bluetoothSupported, connectBluetooth, connectUsb, getPrinterPrefs, printReceipt, setPrinterPrefs, usbSupported, type PrinterMode, type PrinterPrefs,
} from "@/lib/printing/transport";
import type { ReceiptData } from "@/lib/printing/types";

/** Per-device printer settings. Stored on this device only: each till has its own printer. */
export function PrinterPanel({ sample }: { sample: ReceiptData }) {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<PrinterPrefs>({ mode: "browser", auto: false });
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string }>();
  const [busy, setBusy] = useState(false);
  const save = (p: PrinterPrefs) => { setPrefs(p); setPrinterPrefs(p); };

  async function connect() {
    setBusy(true); setStatus(undefined);
    try {
      const name = prefs.mode === "usb" ? await connectUsb() : await connectBluetooth();
      setStatus({ tone: "success", text: `Connected to ${name}. Press "Test print".` });
    } catch (e) { setStatus({ tone: "error", text: e instanceof Error ? e.message : "Couldn't connect." }); }
    setBusy(false);
  }
  async function test() {
    setBusy(true); setStatus(undefined);
    const r = await printReceipt({ ...sample, ref: "TEST", lines: [{ name: "Test item", quantity: 1, unitPrice: 1000, lineTotal: 1000 }], subtotal: 1000, discount: 0, total: 1000, paid: 1000, change: 0 });
    setStatus(r.note ? { tone: "error", text: r.note } : { tone: "success", text: r.via === "direct" ? "Sent to the printer." : "Print dialog opened." });
    setBusy(false);
  }

  const modes: { key: PrinterMode; label: string; hint: string; ok: boolean }[] = [
    { key: "browser", label: "Normal printing", hint: "Any printer installed on this device (USB or system Bluetooth). Works everywhere. In the print dialog choose your roll size as the paper, and turn off headers and footers.", ok: true },
    { key: "usb", label: "Direct USB (beta)", hint: "Sends straight to a USB receipt printer from Chrome/Edge on PC or Android.", ok: usbSupported() },
    { key: "bluetooth", label: "Direct Bluetooth (beta)", hint: "Sends straight to a Bluetooth receipt printer from Chrome on Android or PC. Not available on iPhone.", ok: bluetoothSupported() },
  ];

  return (
    <div className="relative">
      <button type="button" onClick={() => { if (!open) setPrefs(getPrinterPrefs()); setOpen(!open); }} className="text-sm text-slate-600 underline hover:text-slate-900">Printer settings</button>
      {open && (
        <div className="absolute left-0 z-30 mt-2 w-80 max-w-[90vw] space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-lg">
          <p className="text-xs text-slate-500">Paper: {sample.widthMm} mm roll (change in Settings). These choices apply to this device only.</p>
          {modes.map((m) => (
            <label key={m.key} className={`flex gap-2 ${m.ok ? "" : "opacity-50"}`}>
              <input type="radio" name="printer-mode" disabled={!m.ok} checked={prefs.mode === m.key} onChange={() => save({ ...prefs, mode: m.key })} className="mt-1" />
              <span><span className="font-medium">{m.label}</span><span className="block text-xs text-slate-500">{m.ok ? m.hint : "Not supported by this browser."}</span></span>
            </label>
          ))}
          {prefs.mode !== "browser" && <Button variant="secondary" onClick={connect} disabled={busy}>Connect printer…</Button>}
          <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.auto} onChange={(e) => save({ ...prefs, auto: e.target.checked })} /> Print automatically after each sale</label>
          <Button variant="secondary" onClick={test} disabled={busy}>Test print</Button>
          {status && <Alert tone={status.tone}>{status.text}</Alert>}
        </div>
      )}
    </div>
  );
}
