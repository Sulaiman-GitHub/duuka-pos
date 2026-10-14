import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { platformGuard } from "@/lib/guard";
import { NewShopForm } from "./new-shop-form";

export const metadata: Metadata = { title: "New shop" };

export default async function NewShopPage() {
  await platformGuard();
  return (
    <>
      <PageHeader title="New shop" subtitle="Creates the shop, its first administrator and starter categories. The administrator then adds their own managers and cashiers." />
      <Card className="max-w-2xl p-6"><NewShopForm /></Card>
    </>
  );
}
