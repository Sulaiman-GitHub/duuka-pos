"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Alert, Button, inputCls } from "@/components/ui";
import { createCategory, deleteCategory } from "../actions";

export function CategoryManager({ categories }: { categories: { id: string; name: string; description: string | null; count: number }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: { error?: string }, fd: FormData) => {
    const r = await createCategory(prev, fd);
    if (!r.error) formRef.current?.reset();
    return r;
  }, {});
  const [delError, setDelError] = useState<string>();
  const [delPending, start] = useTransition();

  return (
    <div className="space-y-5">
      <form ref={formRef} action={action} className="flex flex-wrap gap-2">
        <input name="name" required placeholder="New category name" className={`${inputCls} flex-1 min-w-[12rem]`} />
        <Button type="submit" disabled={pending}>Add</Button>
      </form>
      {state.error && <Alert>{state.error}</Alert>}
      {delError && <Alert>{delError}</Alert>}
      <ul className="divide-y divide-slate-100">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-3 text-sm">
            <span><span className="font-medium">{c.name}</span> <span className="text-slate-500">· {c.count} product{c.count === 1 ? "" : "s"}</span></span>
            <button
              disabled={delPending}
              onClick={() => {
                if (!confirm(`Delete category "${c.name}"?`)) return;
                start(async () => setDelError((await deleteCategory(c.id)).error));
              }}
              className="text-red-600 hover:underline disabled:opacity-50"
            >
              Delete
            </button>
          </li>
        ))}
        {categories.length === 0 && <li className="py-6 text-center text-sm text-slate-500">No categories yet.</li>}
      </ul>
    </div>
  );
}
