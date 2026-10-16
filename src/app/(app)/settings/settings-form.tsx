"use client";

import { useActionState } from "react";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import { saveSettings, type SettingsState } from "./actions";

type S = { name: string; address: string; phone: string; receiptFooter: string; cashierMaxDiscountPercent: number; receiptWidth: number; expiryAlertDays: number };

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
      <Field label="Receipt paper width" hint="The roll in your receipt printer. Most small printers use 58 mm; larger ones use 80 mm. Check the label on the roll.">
        <select name="receiptWidth" defaultValue={settings.receiptWidth} className={`${inputCls} max-w-[12rem]`}>
          <option value={58}>58 mm (small)</option><option value={80}>80 mm (standard)</option>
        </select>
      </Field>
      <Field label="Warn before products expire (days)" hint="Products with an expiry date are flagged on the Inventory page and Dashboard this many days ahead.">
        <input name="expiryAlertDays" type="number" min={1} max={365} step={1} required defaultValue={settings.expiryAlertDays} className={`${inputCls} max-w-[8rem]`} />
      </Field>
      <Field label="Maximum discount a cashier can give (%)" hint="Managers and admins are not limited. Applies immediately at the till.">
        <input name="cashierMaxDiscountPercent" type="number" min={0} max={100} step={1} required defaultValue={settings.cashierMaxDiscountPercent} className={`${inputCls} max-w-[8rem]`} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
    </form>
  );
}
