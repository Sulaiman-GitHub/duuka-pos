"use client";

import { useActionState } from "react";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import { savePlatformSettings, type BillingFormState } from "../billing-actions";

type S = { businessName: string; address: string; phone: string; email: string; paymentInstructions: string; invoiceFooter: string; trialDays: number };

export function PlatformSettingsForm({ settings }: { settings: S }) {
  const [state, action, pending] = useActionState<BillingFormState, FormData>(savePlatformSettings, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {state.error && <div className="sm:col-span-2"><Alert>{state.error}</Alert></div>}
      {state.ok && <div className="sm:col-span-2"><Alert tone="success">{state.ok}</Alert></div>}
      <Field label="Business name (shown on invoices)"><input name="businessName" defaultValue={settings.businessName} className={inputCls} /></Field>
      <Field label="Email"><input name="email" defaultValue={settings.email} className={inputCls} /></Field>
      <Field label="Address"><input name="address" defaultValue={settings.address} className={inputCls} /></Field>
      <Field label="Phone / WhatsApp"><input name="phone" defaultValue={settings.phone} className={inputCls} /></Field>
      <div className="sm:col-span-2">
        <Field label="How shops should pay" hint="Printed on every unpaid invoice. For example your Mobile Money number and name, or bank details.">
          <textarea name="paymentInstructions" rows={3} defaultValue={settings.paymentInstructions} className={inputCls} />
        </Field>
      </div>
      <Field label="Invoice footer"><input name="invoiceFooter" defaultValue={settings.invoiceFooter} className={inputCls} /></Field>
      <Field label="Free trial for new shops (days)" hint="Applies to shops created from now on."><input name="trialDays" type="number" min={0} max={365} defaultValue={settings.trialDays} className={`${inputCls} max-w-[8rem]`} /></Field>
      <div className="sm:col-span-2"><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button></div>
    </form>
  );
}
