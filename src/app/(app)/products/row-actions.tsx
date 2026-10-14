"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteProduct, toggleProductActive } from "./actions";

export function RowActions({ id, name, isActive }: { id: string; name: string; isActive: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 whitespace-nowrap text-sm">
      <Link href={`/products/${id}/edit`} className="text-brand-500 hover:underline">Edit</Link>
      <button disabled={pending} onClick={() => start(() => toggleProductActive(id))} className="text-slate-600 hover:underline disabled:opacity-50">
        {isActive ? "Deactivate" : "Activate"}
      </button>
      <button
        disabled={pending}
        onClick={() => {
          if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
          start(async () => setError((await deleteProduct(id)).error));
        }}
        className="text-red-600 hover:underline disabled:opacity-50"
      >
        Delete
      </button>
      {error && <span className="basis-full text-right text-xs text-red-600">{error}</span>}
    </div>
  );
}
