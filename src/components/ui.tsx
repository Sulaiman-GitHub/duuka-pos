import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100";

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-brand-500 text-white hover:bg-brand-600",
        variant === "secondary" && "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100",
        className,
      )}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Badge({ tone = "slate", children }: { tone?: "slate" | "green" | "red" | "amber" | "blue"; children: ReactNode }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-blue-100 text-blue-700",
  };
  return <span className={clsx("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function Alert({ tone = "error", children }: { tone?: "error" | "success"; children: ReactNode }) {
  return (
    <div className={clsx("rounded-lg border px-3 py-2 text-sm", tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
      {children}
    </div>
  );
}

export const th = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
export const td = "px-4 py-3 text-sm";
export const tdNum = "px-4 py-3 text-sm text-right whitespace-nowrap tabular-nums";

export function StatTile({
  label, value, sub, delta, tone,
}: { label: string; value: string; sub?: string; delta?: { pct: number | null; vs: string }; tone?: "red" | "amber" }) {
  const up = delta?.pct != null && delta.pct >= 0;
  return (
    <Card className="p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={clsx("mt-1 text-2xl font-semibold tracking-tight", tone === "red" && "text-red-600", tone === "amber" && "text-amber-600")}>{value}</div>
      {delta && (
        <div className="mt-1 text-xs text-slate-500">
          {delta.pct === null ? <span>No sales {delta.vs}</span> : (
            <span className={up ? "text-emerald-700" : "text-red-600"}>{up ? "▲" : "▼"} {Math.abs(delta.pct).toFixed(0)}%<span className="text-slate-500"> vs {delta.vs}</span></span>
          )}
        </div>
      )}
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </Card>
  );
}
