"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import { BUSINESS_TYPES } from "@/lib/templates";
import { createShop, type PlatformFormState } from "../../actions";

export function NewShopForm() {
  const [state, action, pending] = useActionState<PlatformFormState, FormData>(createShop, {});
  const v = (k: string) => (typeof state.values?.[k] === "string" ? (state.values[k] as string) : "");
  const chosen = new Set(Array.isArray(state.values?.types) ? state.values.types : []);
  return (
    <form action={action} className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      <section className="space-y-4">
        <h2 className="font-semibold">Shop</h2>
        <Field label="Shop name *"><input name="shopName" required defaultValue={v("shopName")} className={inputCls} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address"><input name="address" defaultValue={v("address")} className={inputCls} /></Field>
          <Field label="Phone / WhatsApp"><input name="phone" defaultValue={v("phone")} className={inputCls} /></Field>
        </div>
      </section>
      <section className="space-y-3">
        <div><h2 className="font-semibold">What does the shop sell? *</h2><p className="text-sm text-slate-500">Starter categories are created for each kind you tick. The shop can change them later.</p></div>
        <div className="grid gap-2 sm:grid-cols-2">
          {BUSINESS_TYPES.map((t) => (
            <label key={t.key} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50">
              <input type="checkbox" name="types" value={t.key} defaultChecked={chosen.has(t.key)} className="mt-0.5" />
              <span><span className="font-medium">{t.label}</span><span className="block text-xs text-slate-500">{t.categories.slice(0, 4).join(", ")}{t.categories.length > 4 ? "…" : ""}</span></span>
            </label>
          ))}
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="font-semibold">Shop administrator</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name *"><input name="adminName" required defaultValue={v("adminName")} className={inputCls} /></Field>
          <Field label="Email *" hint="Used to sign in. One email belongs to one shop only."><input name="adminEmail" type="email" required defaultValue={v("adminEmail")} className={inputCls} /></Field>
        </div>
        <Field label="Temporary password *" hint="At least 8 characters. Share it securely."><input name="adminPassword" type="password" required minLength={8} autoComplete="new-password" className={inputCls} /></Field>
      </section>
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create shop"}</Button>
        <Link href="/platform" className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link>
      </div>
    </form>
  );
}
