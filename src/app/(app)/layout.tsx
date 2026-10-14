import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { NAV } from "@/components/nav";
import { can } from "@/lib/permissions";
import { getUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const items = NAV.filter((n) => can(user.role, n.perm)).map(({ href, label, icon }) => ({ href, label, icon }));
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar items={items} user={{ name: user.name, role: user.role }} />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
