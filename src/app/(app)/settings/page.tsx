import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { pageGuard } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await pageGuard("settings.manage");
  return (
    <>
      <PageHeader title="Settings" subtitle="Shop details shown on receipts, and till rules" />
      <Card className="max-w-xl p-6"><SettingsForm settings={await getSettings()} /></Card>
    </>
  );
}
