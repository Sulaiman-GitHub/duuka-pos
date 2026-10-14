import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { pageGuard } from "@/lib/guard";
import { updateSupplier } from "../../actions";
import { SupplierForm } from "../../supplier-form";

export const metadata: Metadata = { title: "Edit supplier" };

export default async function EditSupplierPage({ params }: PageProps<"/suppliers/[id]/edit">) {
  await pageGuard("suppliers.manage");
  const { id } = await params;
  const s = await db.supplier.findUnique({ where: { id } });
  if (!s) notFound();
  return (<><PageHeader title={`Edit ${s.name}`} /><Card className="max-w-xl p-6"><SupplierForm action={updateSupplier.bind(null, id)} supplier={s} /></Card></>);
}
