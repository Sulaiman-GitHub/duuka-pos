import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-slate-500">That page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/" className="text-brand-500 hover:underline">Back to home</Link>
    </main>
  );
}
