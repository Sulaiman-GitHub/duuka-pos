"use client";

import { MessageCircle, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { PrinterPanel } from "@/components/printer-panel";
import { getPrinterPrefs, printReceipt } from "@/lib/printing/transport";
import { normalizePhone, receiptToText, whatsappLink } from "@/lib/whatsapp";
import type { ReceiptData } from "@/lib/printing/types";

/** Print button for a receipt (plus printer settings). With `autoPrint`, prints once when shown if the device is set to. */
export function ReceiptActions({ data, autoPrint = false }: { data: ReceiptData; autoPrint?: boolean }) {
  const [note, setNote] = useState<string>();
  const done = useRef(false);
  const print = async () => setNote((await printReceipt(data)).note);

  useEffect(() => {
    if (!autoPrint || done.current) return;
    done.current = true;
    if (getPrinterPrefs().auto) void printReceipt(data).then((r) => setNote(r.note));
  }, [autoPrint, data]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={print}><Printer size={16} /> Print receipt</Button>
        <WhatsAppButton data={data} />
        <PrinterPanel sample={data} />
      </div>
      {note && <p className="text-xs text-amber-700">{note}</p>}
    </div>
  );
}

/** Sends the receipt to the customer on WhatsApp: straight to their number if we have it, otherwise asks for it. */
function WhatsAppButton({ data }: { data: ReceiptData }) {
  const known = normalizePhone(data.customerPhone, data.currency);
  const [asking, setAsking] = useState(false);
  const [number, setNumber] = useState(data.customerPhone ?? "");
  const [error, setError] = useState<string>();
  const open = (phone: string | null) => window.open(whatsappLink(phone, receiptToText(data)), "_blank", "noopener");

  function send() {
    const phone = normalizePhone(number, data.currency);
    if (!phone) return setError("Enter a valid phone number, for example 0772 123 456.");
    setError(undefined);
    open(phone);
  }

  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => (known ? open(known) : setAsking(!asking))} className="!border-emerald-300 !text-emerald-700 hover:!bg-emerald-50">
        <MessageCircle size={16} /> WhatsApp
      </Button>
      {asking && !known && (
        <div className="absolute left-0 z-30 mt-2 w-72 max-w-[90vw] space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
          <label className="block text-xs font-medium text-slate-600" htmlFor="wa-number">Customer&apos;s WhatsApp number</label>
          <input id="wa-number" value={number} onChange={(e) => setNumber(e.target.value)} inputMode="tel" placeholder="0772 123 456" className="w-full rounded-lg border border-slate-300 px-3 py-2" autoFocus />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={send}>Send</Button>
            <Button variant="secondary" onClick={() => open(null)}>Choose in WhatsApp</Button>
          </div>
        </div>
      )}
    </div>
  );
}
