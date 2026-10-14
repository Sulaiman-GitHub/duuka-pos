"use client";

import { Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { PrinterPanel } from "@/components/printer-panel";
import { getPrinterPrefs, printReceipt } from "@/lib/printing/transport";
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
        <PrinterPanel sample={data} />
      </div>
      {note && <p className="text-xs text-amber-700">{note}</p>}
    </div>
  );
}
