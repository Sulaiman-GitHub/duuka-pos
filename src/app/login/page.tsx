import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui";
import { getUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getUser()) redirect("/");
  const { next, done } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-xl font-bold text-white">D</div>
          <h1 className="text-xl font-semibold">Duuka POS</h1>
          <p className="text-sm text-slate-500">Sign in to continue</p>
        </div>
        {done && <div className="mb-4"><Alert tone="success">Password saved. You can sign in now.</Alert></div>}
        <LoginForm next={typeof next === "string" ? next : undefined} />
        <p className="mt-4 text-center text-sm"><Link href="/forgot-password" className="text-slate-500 hover:text-brand-600 hover:underline">Forgot your password?</Link></p>
      </div>
    </main>
  );
}
