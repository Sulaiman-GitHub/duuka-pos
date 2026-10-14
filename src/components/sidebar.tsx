"use client";

import clsx from "clsx";
import { BarChart3, Boxes, History, LayoutDashboard, LogOut, Menu, Package, Receipt, Settings, ShoppingCart, Truck, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/login/actions";

const icons = { LayoutDashboard, ShoppingCart, Receipt, Package, Boxes, Truck, BarChart3, Users, History, Settings };

export function Sidebar({ items, user }: { items: { href: string; label: string; icon: string }[]; user: { name: string; role: string } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex-1 space-y-1 p-3">
      {items.map((it) => {
        const Icon = icons[it.icon as keyof typeof icons];
        const active = pathname === it.href || pathname.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            onClick={() => setOpen(false)}
            className={clsx("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition", active ? "bg-brand-500 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white")}
          >
            <Icon size={18} /> {it.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <div className="no-print flex items-center justify-between bg-slate-900 px-4 py-3 text-white lg:hidden">
        <span className="font-semibold">Duuka POS</span>
        <button aria-label="Toggle menu" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      </div>
      <aside className={clsx("no-print fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-slate-900 text-white transition-transform lg:static lg:translate-x-0", open ? "translate-x-0 top-12" : "-translate-x-full")}>
        <div className="hidden items-center gap-3 border-b border-slate-800 px-5 py-5 lg:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 font-bold">D</div>
          <span className="text-lg font-semibold">Duuka POS</span>
        </div>
        {nav}
        <div className="border-t border-slate-800 p-4">
          <div className="mb-3 text-sm">
            <div className="font-medium">{user.name}</div>
            <div className="text-xs capitalize text-slate-400">{user.role.toLowerCase()}</div>
          </div>
          <form action={logout}>
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white">
              <LogOut size={16} /> Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
