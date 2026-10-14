import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell subtitle="Reset your password">
      <ForgotForm />
      <p className="mt-4 text-center text-sm"><Link href="/login" className="text-brand-600 hover:underline">Back to sign in</Link></p>
    </AuthShell>
  );
}
