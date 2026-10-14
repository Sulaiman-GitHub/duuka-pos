"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import type { UserFormState } from "./actions";

type U = { name: string; email: string; role: string; isActive: boolean };
type Action = (p: UserFormState, fd: FormData) => Promise<UserFormState>;

export function UserForm({ action, user }: { action: Action; user?: U }) {
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(action, {});
  const v = (k: keyof U | "password", fb = "") => state.values?.[k] ?? fb;
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="Full name"><input name="name" required defaultValue={v("name", user?.name)} className={inputCls} /></Field>
      <Field label="Email" hint={user ? "Email can't be changed" : "Used to sign in"}>
        <input name="email" type="email" required defaultValue={v("email", user?.email)} disabled={!!user} className={inputCls} />
      </Field>
      <Field label="Role" hint="Admin: everything. Manager: reports, inventory, suppliers. Cashier: sales only.">
        <select name="role" defaultValue={v("role", user?.role ?? "CASHIER")} className={inputCls}>
          <option value="CASHIER">Cashier</option><option value="MANAGER">Manager</option><option value="ADMIN">Administrator</option>
        </select>
      </Field>
      {!user && <Field label="Temporary password" hint="At least 8 characters. Share it securely."><input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} /></Field>}
      {user && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={user.isActive} /> Account is active (can sign in)</label>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : user ? "Save changes" : "Create user"}</Button>
        <Link href="/users" className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link>
      </div>
    </form>
  );
}

export function PasswordForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(action, {});
  return (
    <form action={formAction} className="space-y-3">
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
      <Field label="New password"><input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} /></Field>
      <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Updating…" : "Reset password"}</Button>
    </form>
  );
}
