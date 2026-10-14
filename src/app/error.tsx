"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Details stay in the server log; the user only sees a reference.
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-slate-500">We couldn&apos;t complete that. Please try again, and if it keeps happening let an administrator know{error.digest ? ` (reference ${error.digest})` : ""}.</p>
      <button onClick={reset} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">Try again</button>
    </main>
  );
}
