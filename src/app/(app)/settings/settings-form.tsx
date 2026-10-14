"use client";

import { useActionState } from "react";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import { saveSettings, type SettingsState } from "./actions";

type S = { name: string; address: string; phone: string; receiptFooter: string; cashierMaxDiscountPercent: number };

export function SettingsForm({ settings }: { settings: S }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
      <Field label="Shop name" hint="Printed at the top of receipts and reports"><input name="name" required defaultValue={settings.name} className={inputCls} /></Field>
      <Field label="Address"><input name="address" required defaultValue={settings.address} className={inputCls} /></Field>
      <Field label="Phone / WhatsApp"><input name="phone" required defaultValue={settings.phone} className={inputCls} /></Field>
      <Field label="Receipt footer message"><input name="receiptFooter" defaultValue={settings.receiptFooter} className={inputCls} /></Field>
      <Field label="Maximum discount a cashier can give (%)" hint="Managers and admins are not limited. Applies immediately at the till.">
        <input name="cashierMaxDiscountPercent" type="number" min={0} max={100} step={1} required defaultValue={settings.cashierMaxDiscountPercent} className={`${inputCls} max-w-[8rem]`} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
    </form>
  );
}
