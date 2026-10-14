"use client";

import { useActionState } from "react";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import { setPassword, type SetPasswordState } from "./actions";

export function SetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<SetPasswordState, FormData>(setPassword, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="New password" hint="At least 8 characters"><input name="password" type="password" required minLength={8} autoComplete="new-password" autoFocus className={inputCls} /></Field>
      <Field label="Confirm password"><input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputCls} /></Field>
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving…" : "Save password"}</Button>
    </form>
  );
}
