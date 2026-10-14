"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { Alert, Button, Field, inputCls } from "@/components/ui";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="Email">
        <input name="email" type="email" required autoComplete="username" autoFocus className={inputCls} />
      </Field>
      <Field label="Password">
        <input name="password" type="password" required autoComplete="current-password" className={inputCls} />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
