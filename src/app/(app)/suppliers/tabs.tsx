import clsx from "clsx";
import Link from "next/link";

export function SupplierTabs({ active }: { active: "suppliers" | "orders" }) {
  const tabs = [{ key: "suppliers", href: "/suppliers", label: "Suppliers" }, { key: "orders", href: "/suppliers/orders", label: "Purchase orders" }];
  return (
    <div className="mb-5 flex gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} className={clsx("-mb-px border-b-2 px-4 py-2 text-sm font-medium", active === t.key ? "border-brand-500 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-800")}>{t.label}</Link>
      ))}
    </div>
  );
}
