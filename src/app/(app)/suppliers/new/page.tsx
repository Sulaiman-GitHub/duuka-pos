import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { pageGuard } from "@/lib/guard";
import { createSupplier } from "../actions";
import { SupplierForm } from "../supplier-form";

export const metadata: Metadata = { title: "New supplier" };

export default async function NewSupplierPage() {
  await pageGuard("suppliers.manage");
  return (<><PageHeader title="New supplier" /><Card className="max-w-xl p-6"><SupplierForm action={createSupplier} /></Card></>);
}
