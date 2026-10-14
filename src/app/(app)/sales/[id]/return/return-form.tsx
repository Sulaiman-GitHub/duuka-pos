"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import { formatUGX } from "@/lib/money";
import { processReturn } from "../../actions";

type Item = { id: string; name: string; unitPrice: number; remaining: number };

export function ReturnForm({ saleId, subtotal, total, items }: { saleId: string; subtotal: number; total: number; items: Item[] }) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const share = subtotal > 0 ? total / subtotal : 1;
  const estimate = items.reduce((s, i) => s + Math.round(i.unitPrice * (qty[i.id] ?? 0) * share), 0);
  const nothingLeft = items.every((i) => i.remaining === 0);

  function submit() {
    setError(undefined);
    start(async () => {
      const r = await processReturn({ saleId, reason, restock, items: items.map((i) => ({ saleItemId: i.id, quantity: qty[i.id] ?? 0 })) });
      if (r.error) setError(r.error);
      else router.push(`/sales/${saleId}`);
    });
  }

  if (nothingLeft) return <Alert>Every item on this sale has already been returned.</Alert>;
  return (
    <div className="space-y-5">
      {error && <Alert>{error}</Alert>}
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {items.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div>
              <div className="font-medium">{i.name}</div>
              <div className="text-xs text-slate-500">{formatUGX(i.unitPrice)} each · {i.remaining} returnable</div>
            </div>
            <input type="number" min={0} max={i.remaining} disabled={i.remaining === 0} value={qty[i.id] ?? 0}
              onChange={(e) => setQty({ ...qty, [i.id]: Math.max(0, Math.min(i.remaining, parseInt(e.target.value, 10) || 0)) })} className={`${inputCls} !w-20 text-center`} aria-label={`Quantity of ${i.name} to return`} />
          </div>
        ))}
      </div>
      <Field label="Reason for return"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged on delivery, wrong item" className={inputCls} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> Put returned items back into stock</label>
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
        <span className="text-sm text-slate-600">Refund to customer {total !== subtotal && "(discount applied)"}</span>
        <span className="text-lg font-semibold">{formatUGX(estimate)}</span>
      </div>
      <Button onClick={submit} disabled={pending || estimate === 0}>{pending ? "Processing…" : "Confirm return & refund"}</Button>
    </div>
  );
}
