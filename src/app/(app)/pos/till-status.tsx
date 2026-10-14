"use client";

import clsx from "clsx";
import { Printer, RefreshCw, WifiOff } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { useMoney } from "@/components/currency";
import type { FlushOutcome } from "@/lib/offline/sync";
import type { LocalReceipt, PosCatalog, QueuedSale } from "@/lib/offline/types";

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kampala" });

export function TillStatus({ online, queue, catalog, signedOut, lastSync, onSync, onDiscard, onRetry }: {
  online: boolean; queue: QueuedSale[]; catalog: PosCatalog; signedOut: boolean; lastSync?: FlushOutcome;
  onSync: () => void; onDiscard: (id: string) => void; onRetry: (q: QueuedSale) => void;
}) {
  const money = useMoney();
  const pending = queue.filter((q) => q.status === "pending");
  const failed = queue.filter((q) => q.status === "failed");
  return (
    <div className="mb-3 space-y-2 text-sm">
      <div className={clsx("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2", online ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-900")}>
        <span className="flex items-center gap-1.5 font-medium">
          {online ? <span className="h-2 w-2 rounded-full bg-emerald-500" /> : <WifiOff size={15} />}
          {online ? "Online" : "Offline — you can keep selling. Sales are saved on this device."}
        </span>
        <span className="text-xs opacity-80">Prices &amp; stock as of {time(catalog.generatedAt)}</span>
        {pending.length > 0 && (
          <span className="ml-auto flex items-center gap-2">
            <strong>{pending.length} sale{pending.length === 1 ? "" : "s"} waiting to upload</strong>
            {online && <button onClick={onSync} className="inline-flex items-center gap-1 rounded border border-current px-2 py-0.5 text-xs font-medium hover:bg-white/60"><RefreshCw size={12} /> Upload now</button>}
          </span>
        )}
        {pending.length === 0 && lastSync && lastSync.uploaded > 0 && <span className="ml-auto text-xs">{lastSync.uploaded} sale{lastSync.uploaded === 1 ? "" : "s"} uploaded</span>}
      </div>
      {signedOut && pending.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">
          Your sign-in has expired, so {pending.length === 1 ? "this sale cannot" : "these sales cannot"} be uploaded yet. Nothing is lost.{" "}
          <Link href="/login?next=/pos" className="font-medium underline">Sign in again</Link> when you have a connection.
        </div>
      )}
      {failed.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-900">
          <div className="font-medium">{failed.length} sale{failed.length === 1 ? "" : "s"} could not be uploaded</div>
          {failed.map((q) => (
            <div key={q.clientId} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="min-w-0 flex-1">{time(q.createdAt)} · {money(q.receipt.total)} · {q.receipt.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ")} — <em>{q.error}</em></span>
              <button onClick={() => onRetry(q)} className="font-medium underline">Try again</button>
              <button onClick={() => { if (confirm("Discard this sale? It will NOT be recorded. Only do this if you will enter it again by hand.")) onDiscard(q.clientId); }} className="font-medium text-red-700 underline">Discard</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LocalReceiptModal({ refNo, receipt, catalog, at, onClose }: { refNo: string; receipt: LocalReceipt; catalog: PosCatalog; at: string; onClose: () => void }) {
  const money = useMoney();
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Receipt">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <div className="no-print mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Saved on this device. It will upload automatically when the connection is back, and then gets its final receipt number.
        </div>
        <article className="receipt-print font-mono text-sm">
          <header className="text-center">
            <h2 className="text-lg font-bold">{catalog.shopName}</h2>
            <p className="text-xs text-slate-600">{catalog.address}</p>
            <p className="text-xs text-slate-600">{catalog.phone}</p>
          </header>
          <div className="my-3 space-y-0.5 border-y border-dashed border-slate-300 py-2 text-xs">
            <div className="flex justify-between"><span>Ref</span><span className="font-semibold">{refNo} (provisional)</span></div>
            <div className="flex justify-between"><span>Date</span><span>{new Date(at).toLocaleString("en-GB", { timeZone: "Africa/Kampala" })}</span></div>
            <div className="flex justify-between"><span>Cashier</span><span>{receipt.cashierName}</span></div>
            {receipt.customerName && <div className="flex justify-between"><span>Customer</span><span>{receipt.customerName}</span></div>}
          </div>
          <table className="w-full text-xs">
            <tbody>
              {receipt.lines.map((l, i) => (
                <tr key={i} className="align-top"><td className="pr-2">{l.name}<div className="text-slate-500">{l.quantity} × {money(l.unitPrice)}</div></td><td className="text-right">{money(l.quantity * l.unitPrice)}</td></tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-3 space-y-0.5 border-t border-dashed border-slate-300 pt-2 text-xs">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(receipt.subtotal)}</dd></div>
            {receipt.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>− {money(receipt.discount)}</dd></div>}
            <div className="flex justify-between text-base font-bold"><dt>TOTAL</dt><dd>{money(receipt.total)}</dd></div>
            <div className="flex justify-between"><dt>Paid ({receipt.methodLabel})</dt><dd>{money(receipt.paid)}</dd></div>
            {receipt.change > 0 && <div className="flex justify-between"><dt>Change</dt><dd>{money(receipt.change)}</dd></div>}
          </dl>
          <p className="mt-3 text-center text-xs text-slate-600">{catalog.receiptFooter}</p>
        </article>
        <div className="no-print mt-4 flex gap-2">
          <Button onClick={() => window.print()} variant="secondary"><Printer size={15} className="mr-1.5 inline" />Print</Button>
          <Button onClick={onClose} className="flex-1">New sale</Button>
        </div>
      </div>
    </div>
  );
}
