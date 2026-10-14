"use client";

import { useActionState } from "react";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import { requestReset, type ForgotState } from "./actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(requestReset, {});
  if (state.done) return <Alert tone="success">If that email belongs to an account, a reset link is on its way. It is valid for 1 hour. If email isn&apos;t set up for your shop, ask your shop administrator to send you a link.</Alert>;
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="Email"><input name="email" type="email" required autoComplete="username" autoFocus className={inputCls} /></Field>
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Sending…" : "Send reset link"}</Button>
    </form>
  );
}
