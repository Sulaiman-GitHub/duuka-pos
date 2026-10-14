"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import type { FormState } from "./actions";

type S = { name: string; phone: string | null; email: string | null; address: string | null; isActive: boolean };

export function SupplierForm({ action, supplier }: { action: (p: FormState, fd: FormData) => Promise<FormState>; supplier?: S }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const v = (k: keyof S, fb: string | null | undefined) => state.values?.[k] ?? fb ?? "";
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="Supplier name *"><input name="name" required defaultValue={v("name", supplier?.name)} className={inputCls} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone"><input name="phone" defaultValue={v("phone", supplier?.phone)} className={inputCls} /></Field>
        <Field label="Email"><input name="email" type="email" defaultValue={v("email", supplier?.email)} className={inputCls} /></Field>
      </div>
      <Field label="Address"><input name="address" defaultValue={v("address", supplier?.address)} className={inputCls} /></Field>
      {supplier && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={supplier.isActive} /> Active supplier</label>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : supplier ? "Save changes" : "Add supplier"}</Button>
        <Link href="/suppliers" className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link>
      </div>
    </form>
  );
}
