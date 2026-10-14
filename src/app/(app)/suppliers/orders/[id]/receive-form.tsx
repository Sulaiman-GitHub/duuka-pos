"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import { receiveStock } from "../../actions";

export function ReceiveForm({ orderId, items }: { orderId: string; items: { id: string; name: string; remaining: number }[] }) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [invoiceNo, setInvoiceNo] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const open = items.filter((i) => i.remaining > 0);
  const total = Object.values(qty).reduce((s, n) => s + n, 0);

  function submit() {
    setError(undefined);
    start(async () => {
      const r = await receiveStock(orderId, { invoiceNo: invoiceNo || undefined, lines: open.map((i) => ({ itemId: i.id, quantity: qty[i.id] ?? 0 })) });
      if (r.error) setError(r.error);
      else { setQty({}); setInvoiceNo(""); router.refresh(); }
    });
  }

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {open.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <div><div className="font-medium">{i.name}</div><div className="text-xs text-slate-500">{i.remaining} still to arrive</div></div>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={i.remaining} value={qty[i.id] ?? 0} onChange={(e) => setQty({ ...qty, [i.id]: Math.max(0, Math.min(i.remaining, parseInt(e.target.value, 10) || 0)) })} className={`${inputCls} !w-24 text-right`} aria-label={`Received quantity of ${i.name}`} />
              <button className="text-xs text-brand-600 hover:underline" onClick={() => setQty({ ...qty, [i.id]: i.remaining })}>All</button>
            </div>
          </div>
        ))}
      </div>
      <div className="max-w-xs"><Field label="Supplier invoice number (optional)"><input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className={inputCls} /></Field></div>
      <Button onClick={submit} disabled={pending || total === 0}>{pending ? "Receiving…" : `Receive ${total} unit${total === 1 ? "" : "s"} into stock`}</Button>
    </div>
  );
}
