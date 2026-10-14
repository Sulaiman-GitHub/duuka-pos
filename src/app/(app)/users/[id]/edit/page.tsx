import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { pageGuard } from "@/lib/guard";
import { resetPassword, updateUser } from "../../actions";
import { PasswordForm, UserForm } from "../../user-form";

export const metadata: Metadata = { title: "Edit user" };

export default async function EditUserPage({ params }: PageProps<"/users/[id]/edit">) {
  await pageGuard("users.manage");
  const { id } = await params;
  const u = await db.user.findUnique({ where: { id }, select: { name: true, email: true, role: true, isActive: true } });
  if (!u) notFound();
  return (
    <>
      <PageHeader title={`Edit ${u.name}`} subtitle={u.email} />
      <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
        <Card className="p-6"><UserForm action={updateUser.bind(null, id)} user={u} /></Card>
        <Card className="h-fit p-6"><h2 className="mb-3 font-semibold">Reset password</h2><PasswordForm action={resetPassword.bind(null, id)} /></Card>
      </div>
    </>
  );
}
