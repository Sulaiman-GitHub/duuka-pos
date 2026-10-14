import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { pageGuard } from "@/lib/guard";
import { createUser } from "../actions";
import { UserForm } from "../user-form";

export const metadata: Metadata = { title: "New user" };

export default async function NewUserPage() {
  await pageGuard("users.manage");
  return (<><PageHeader title="New user" /><Card className="max-w-xl p-6"><UserForm action={createUser} /></Card></>);
}
