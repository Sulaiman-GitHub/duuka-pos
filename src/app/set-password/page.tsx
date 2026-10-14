import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/ui";
import { peekToken } from "@/lib/tokens";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Choose a password" };

export default async function SetPasswordPage({ searchParams }: PageProps<"/set-password">) {
  const { token } = await searchParams;
  const row = typeof token === "string" ? await peekToken(token) : null;
  return (
    <AuthShell subtitle={row ? `Choose a password for ${row.user.email}` : "Choose a password"}>
      {row && typeof token === "string" ? (
        <SetPasswordForm token={token} />
      ) : (
        <>
          <Alert>This link is invalid or has expired.</Alert>
          <p className="mt-4 text-center text-sm"><Link href="/forgot-password" className="text-brand-600 hover:underline">Request a new link</Link></p>
        </>
      )}
    </AuthShell>
  );
}
