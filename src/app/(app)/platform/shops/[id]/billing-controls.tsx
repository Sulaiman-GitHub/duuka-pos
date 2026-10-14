"use client";

import { useActionState, useState, useTransition } from "react";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import { cancelInvoice, issueInvoice, recordPayment, savePlan, type BillingFormState } from "../../billing-actions";

export function PlanForm({ shopId, plan, currency }: { shopId: string; plan: { planName: string; monthlyPrice: number; maxUsers: number; trialEndsAt: string; billingNote: string }; currency: string }) {
  const [state, action, pending] = useActionState<BillingFormState, FormData>(savePlan.bind(null, shopId), {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {state.error && <div className="sm:col-span-2"><Alert>{state.error}</Alert></div>}
      {state.ok && <div className="sm:col-span-2"><Alert tone="success">{state.ok}</Alert></div>}
      <Field label="Plan name"><input name="planName" required defaultValue={plan.planName} className={inputCls} /></Field>
      <Field label={`Price per month (${currency})`} hint="0 = free"><input name="monthlyPrice" type="number" min={0} step={1} required defaultValue={plan.monthlyPrice} className={inputCls} /></Field>
      <Field label="Active staff accounts allowed"><input name="maxUsers" type="number" min={1} required defaultValue={plan.maxUsers} className={inputCls} /></Field>
      <Field label="Free trial ends" hint="Leave empty for no trial"><input name="trialEndsAt" type="date" defaultValue={plan.trialEndsAt} className={inputCls} /></Field>
      <div className="sm:col-span-2"><Field label="Private note (only you see this)"><input name="billingNote" defaultValue={plan.billingNote} className={inputCls} /></Field></div>
      <div className="sm:col-span-2"><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save plan"}</Button></div>
    </form>
  );
}

export function NewInvoiceForm({ shopId, monthlyPrice, currency }: { shopId: string; monthlyPrice: number; currency: string }) {
  const [state, action, pending] = useActionState<BillingFormState, FormData>(issueInvoice.bind(null, shopId), {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label="Months"><input name="months" type="number" min={1} max={24} defaultValue={1} className={`${inputCls} !w-20`} /></Field>
      <Field label={`Amount (${currency})`} hint={`Empty = ${monthlyPrice.toLocaleString()} × months`}><input name="amount" type="number" min={0} className={`${inputCls} !w-36`} /></Field>
      <Field label="Note on invoice (optional)"><input name="notes" className={`${inputCls} !w-56`} /></Field>
      <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create invoice"}</Button>
      {state.error && <div className="basis-full"><Alert>{state.error}</Alert></div>}
      {state.ok && <div className="basis-full"><Alert tone="success">{state.ok}</Alert></div>}
    </form>
  );
}

const METHODS = ["Mobile Money", "Bank transfer", "Cash", "Card", "Other"];

export function InvoiceActions({ invoiceId, shopId, today }: { invoiceId: string; shopId: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<BillingFormState, FormData>(recordPayment.bind(null, invoiceId, shopId), {});
  const [cancelling, start] = useTransition();
  const [cancelError, setCancelError] = useState<string>();
  return (
    <div className="space-y-2">
      <div className="flex gap-3 text-sm">
        <button onClick={() => setOpen(!open)} className="font-medium text-brand-600 hover:underline">{open ? "Close" : "Record payment"}</button>
        <button
          disabled={cancelling} className="text-red-600 hover:underline"
          onClick={() => { if (confirm("Cancel this invoice? The shop will no longer see it as owing.")) start(async () => setCancelError((await cancelInvoice(invoiceId, shopId)).error)); }}
        >Cancel</button>
      </div>
      {cancelError && <p className="text-xs text-red-600">{cancelError}</p>}
      {open && (
        <form action={action} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          {state.error && <Alert>{state.error}</Alert>}
          {state.ok && <Alert tone="success">{state.ok}</Alert>}
          <select name="method" className={inputCls} defaultValue="Mobile Money">{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
          <input name="reference" placeholder="Transaction ID / reference" className={inputCls} />
          <input name="paidOn" type="date" defaultValue={today} className={inputCls} aria-label="Date paid" />
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Mark as paid"}</Button>
        </form>
      )}
    </div>
  );
}
