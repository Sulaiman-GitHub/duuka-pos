import { redirect } from "next/navigation";
import { CurrencyProvider } from "@/components/currency";
import { BillingBanner } from "@/components/billing-banner";
import { OfflineBanner } from "@/components/offline-banner";
import { Sidebar } from "@/components/sidebar";
import { NAV } from "@/components/nav";
import { needsAttention } from "@/lib/billing";
import { can } from "@/lib/permissions";
import { getUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const items = NAV.filter((n) => can(user.role, n.perm)).map(({ href, label, icon }) => ({ href, label, icon }));
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar items={items} user={{ name: user.name, role: user.role }} shopName={user.shopName} />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8"><CurrencyProvider currency={user.currency}><OfflineBanner canSell={can(user.role, "pos.sell")} />{user.billing && can(user.role, "billing.view") && needsAttention(user.billing) && <BillingBanner info={user.billing} />}{children}</CurrencyProvider></main>
    </div>
  );
}
