"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import { adjustStock, type AdjustState } from "../actions";

export function AdjustForm({ products, selected }: { products: { id: string; name: string; sku: string; stock: number }[]; selected?: string }) {
  const [state, action, pending] = useActionState<AdjustState, FormData>(adjustStock, {});
  const [productId, setProductId] = useState(state.values?.productId ?? selected ?? "");
  const [mode, setMode] = useState(state.values?.mode ?? "ADD");
  const current = products.find((p) => p.id === productId);

  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="Product">
        <select name="productId" value={productId} onChange={(e) => setProductId(e.target.value)} required className={inputCls}>
          <option value="">Select a product…</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
        </select>
      </Field>
      {current && <p className="text-sm text-slate-600">Current stock: <strong>{current.stock}</strong></p>}
      <Field label="Adjustment type">
        <select name="mode" value={mode} onChange={(e) => setMode(e.target.value)} className={inputCls}>
          <option value="ADD">Add stock (received, found)</option>
          <option value="REMOVE">Remove stock (correction, lost)</option>
          <option value="DAMAGE">Write off damaged / expired</option>
          <option value="SET">Set exact count (stock take)</option>
        </select>
      </Field>
      <Field label={mode === "SET" ? "New stock count" : "Quantity"}>
        <input name="quantity" type="number" min={0} step={1} required defaultValue={state.values?.quantity} className={inputCls} />
      </Field>
      <Field label="Reason">
        <input name="reason" required defaultValue={state.values?.reason} placeholder="e.g. Delivery from supplier, stock count" className={inputCls} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Record adjustment"}</Button>
    </form>
  );
}
