import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">Access denied</h1>
      <p className="text-slate-500">Your role does not have permission to view this page.</p>
      <Link href="/" className="text-brand-500 hover:underline">Back to home</Link>
    </main>
  );
}
