import clsx from "clsx";
import Link from "next/link";

export function InventoryTabs({ active, canAdjust }: { active: "stock" | "history" | "adjust"; canAdjust: boolean }) {
  const tabs = [
    { key: "stock", href: "/inventory", label: "Stock levels" },
    { key: "history", href: "/inventory/history", label: "Stock history" },
    ...(canAdjust ? [{ key: "adjust", href: "/inventory/adjust", label: "Adjust stock" }] : []),
  ];
  return (
    <div className="mb-5 flex gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} className={clsx("-mb-px border-b-2 px-4 py-2 text-sm font-medium", active === t.key ? "border-brand-500 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-800")}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}
