"use client";

import { useActionState, useTransition } from "react";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import { resetShopUserPassword, setShopActive, updateShop, type PlatformFormState } from "../../actions";

export function SuspendButton({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button variant={active ? "danger" : "primary"} disabled={pending}
      onClick={() => { if (!active || confirm("Suspend this shop? None of its staff will be able to sign in until you reactivate it.")) start(() => setShopActive(id, !active)); }}>
      {active ? "Suspend shop" : "Reactivate shop"}
    </Button>
  );
}

export function ShopDetailsForm({ id, shop }: { id: string; shop: { name: string; address: string; phone: string } }) {
  const [state, action, pending] = useActionState<PlatformFormState, FormData>(updateShop.bind(null, id), {});
  return (
    <form action={action} className="space-y-3">
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
      <Field label="Shop name"><input name="shopName" required defaultValue={shop.name} className={inputCls} /></Field>
      <Field label="Address"><input name="address" defaultValue={shop.address} className={inputCls} /></Field>
      <Field label="Phone"><input name="phone" defaultValue={shop.phone} className={inputCls} /></Field>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
    </form>
  );
}

export function PasswordReset({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<PlatformFormState, FormData>(resetShopUserPassword.bind(null, userId), {});
  return (
    <form action={action} className="flex items-center gap-2">
      <input name="password" type="password" required minLength={8} placeholder="New password" autoComplete="new-password" className={`${inputCls} !w-40 !py-1`} aria-label="New password" />
      <Button type="submit" variant="secondary" disabled={pending} className="!px-3 !py-1">Set</Button>
      {state.ok && <span className="text-xs text-emerald-600">{state.ok}</span>}
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
