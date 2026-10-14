"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import { formatUGX } from "@/lib/money";
import { createPurchaseOrder } from "../../actions";

type Product = { id: string; name: string; sku: string; costPrice: number; stock: number; minStock: number };
type Line = { productId: string; quantity: number; unitCost: number };

export function OrderForm({ suppliers, products, supplierId }: { suppliers: { id: string; name: string }[]; products: Product[]; supplierId?: string }) {
  const router = useRouter();
  const byId = new Map(products.map((p) => [p.id, p]));
  const [supplier, setSupplier] = useState(supplierId ?? "");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const total = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
  const lowStock = products.filter((p) => p.stock <= p.minStock && !lines.some((l) => l.productId === p.id));

  const add = (p: Product) => setLines((ls) => ls.some((l) => l.productId === p.id) ? ls : [...ls, { productId: p.id, quantity: Math.max(1, p.minStock * 2 - p.stock), unitCost: p.costPrice }]);
  const patch = (id: string, v: Partial<Line>) => setLines((ls) => ls.map((l) => (l.productId === id ? { ...l, ...v } : l)));

  function save(submit: boolean) {
    setError(undefined);
    start(async () => {
      const r = await createPurchaseOrder({ supplierId: supplier, note: note || undefined, submit, items: lines });
      if (r.error) setError(r.error);
      else router.push(`/suppliers/orders/${r.id}`);
    });
  }

  return (
    <div className="space-y-5">
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Supplier *">
          <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inputCls}>
            <option value="">Select a supplier…</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Delivery instructions, terms…" className={inputCls} /></Field>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[14rem] flex-1">
          <Field label="Add a product">
            <select value={pick} onChange={(e) => { const p = byId.get(e.target.value); if (p) add(p); setPick(""); }} className={inputCls}>
              <option value="">Choose a product…</option>
              {products.filter((p) => !lines.some((l) => l.productId === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku}) — {p.stock} in stock</option>)}
            </select>
          </Field>
        </div>
        {lowStock.length > 0 && <Button variant="secondary" onClick={() => lowStock.forEach(add)}>Add all {lowStock.length} low-stock items</Button>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Product</th><th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Qty</th><th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Unit cost</th><th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Line total</th><th /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => {
              const p = byId.get(l.productId)!;
              return (
                <tr key={l.productId}>
                  <td className="px-3 py-2"><div className="font-medium">{p.name}</div><div className="text-xs text-slate-500">{p.stock} in stock · min {p.minStock}</div></td>
                  <td className="px-3 py-2 text-right"><input type="number" min={1} value={l.quantity} onChange={(e) => patch(l.productId, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })} className={`${inputCls} !w-24 text-right`} aria-label={`Quantity of ${p.name}`} /></td>
                  <td className="px-3 py-2 text-right"><input type="number" min={0} value={l.unitCost} onChange={(e) => patch(l.productId, { unitCost: Math.max(0, parseInt(e.target.value, 10) || 0) })} className={`${inputCls} !w-28 text-right`} aria-label={`Unit cost of ${p.name}`} /></td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatUGX(l.quantity * l.unitCost)}</td>
                  <td className="px-2 text-right"><button aria-label={`Remove ${p.name}`} onClick={() => setLines((ls) => ls.filter((x) => x.productId !== l.productId))} className="text-slate-400 hover:text-red-600"><Trash2 size={16} /></button></td>
                </tr>
              );
            })}
            {lines.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No products added yet.</td></tr>}
          </tbody>
          {lines.length > 0 && <tfoot className="bg-slate-50 font-semibold"><tr><td colSpan={3} className="px-3 py-2 text-right">Order total</td><td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatUGX(total)}</td><td /></tr></tfoot>}
        </table>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => save(true)} disabled={pending || lines.length === 0 || !supplier}>{pending ? "Saving…" : "Place order"}</Button>
        <Button variant="secondary" onClick={() => save(false)} disabled={pending || lines.length === 0 || !supplier}>Save as draft</Button>
      </div>
    </div>
  );
}
