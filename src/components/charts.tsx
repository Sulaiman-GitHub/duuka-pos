"use client";

import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";

const ugx = new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 });
export const full = (n: number) => `UGX ${ugx.format(Math.round(n))}`;
export function compact(n: number) {
  const a = Math.abs(n);
  if (a >= 1e9) return `${+(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

function niceMax(max: number, ticks = 4) {
  if (max <= 0) return { max: ticks, step: 1 };
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  return { max: step * ticks, step };
}

const shortDate = (label: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(label);
  if (!m) return label.replace("Week of ", "");
  return new Date(`${label}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};

function ViewToggle({ view, onChange }: { view: "chart" | "table"; onChange: (v: "chart" | "table") => void }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs" role="group" aria-label="Chart or table view">
      {(["chart", "table"] as const).map((v) => (
        <button key={v} onClick={() => onChange(v)} aria-pressed={view === v}
          className={clsx("rounded-md px-2.5 py-1 capitalize", view === v ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:text-slate-800")}>{v}</button>
      ))}
    </div>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50"><tr>{head.map((h, i) => <th key={h} className={clsx("px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500", i === 0 ? "text-left" : "text-right")}>{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={clsx("px-3 py-1.5 tabular-nums", j === 0 ? "text-left" : "text-right")}>{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

export function ChartCard({ title, subtitle, toolbar, children }: { title: string; subtitle?: string; toolbar?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {toolbar}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- trend (line + area)
export function TrendChart({ title, subtitle, seriesName, data }: { title: string; subtitle?: string; seriesName: string; data: { label: string; value: number }[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const H = 250, m = { t: 14, r: 56, b: 26, l: 48 };
  const iw = width - m.l - m.r, ih = H - m.t - m.b;
  const { max, step } = useMemo(() => niceMax(Math.max(0, ...data.map((d) => d.value))), [data]);
  const n = data.length;
  const x = (i: number) => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => m.t + ih - (v / max) * ih;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join("");
  const area = n ? `${line}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : "";
  const yTicks = Array.from({ length: 5 }, (_, i) => i * step);
  // Fewer date labels on narrow charts so they never collide.
  const maxTicks = iw < 260 ? 2 : iw < 420 ? 3 : 6;
  const xTickIdx = n <= maxTicks ? data.map((_, i) => i) : Array.from({ length: maxTicks }, (_, i) => Math.round((i * (n - 1)) / (maxTicks - 1)));

  const total = data.reduce((s, d) => s + d.value, 0);
  const active = hover !== null ? data[hover] : null;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round(((px - m.l) / iw) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") { e.preventDefault(); setHover((h) => Math.max(0, (h ?? n) - 1)); }
    if (e.key === "ArrowRight") { e.preventDefault(); setHover((h) => Math.min(n - 1, (h ?? -1) + 1)); }
    if (e.key === "Escape") setHover(null);
  }

  return (
    <ChartCard title={title} subtitle={subtitle} toolbar={<ViewToggle view={view} onChange={setView} />}>
      {view === "table" ? (
        <DataTable head={["Date", seriesName]} rows={data.map((d) => [d.label, full(d.value)])} />
      ) : (
        <div ref={wrap} className="relative">
          <svg width={width} height={H} role="img" aria-label={`${seriesName} over time, total ${full(total)}. Use left and right arrow keys to read each point.`}
            tabIndex={0} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onKeyDown={onKey} onBlur={() => setHover(null)} className="touch-none outline-none focus-visible:ring-2 focus-visible:ring-brand-100">
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" strokeWidth={1} />
                <text x={m.l - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--viz-text-muted)" className="tabular-nums">{compact(t)}</text>
              </g>
            ))}
            {xTickIdx.map((i) => (
              <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={11} fill="var(--viz-text-muted)">{shortDate(data[i].label)}</text>
            ))}
            {n > 0 && <path d={area} fill="var(--viz-series-1)" fillOpacity={0.1} />}
            {n > 0 && <path d={line} fill="none" stroke="var(--viz-series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
            {n > 0 && hover === null && (
              <>
                <circle cx={x(n - 1)} cy={y(data[n - 1].value)} r={5} fill="var(--viz-series-1)" stroke="var(--viz-surface)" strokeWidth={2} />
                <text x={x(n - 1) + 10} y={y(data[n - 1].value)} dominantBaseline="middle" fontSize={11} fontWeight={600} fill="var(--viz-text-primary)">{compact(data[n - 1].value)}</text>
              </>
            )}
            {active && hover !== null && (
              <>
                <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={y(0)} stroke="var(--viz-text-muted)" strokeWidth={1} />
                <circle cx={x(hover)} cy={y(active.value)} r={5} fill="var(--viz-series-1)" stroke="var(--viz-surface)" strokeWidth={2} />
              </>
            )}
          </svg>
          {active && hover !== null && (
            <div className="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
              style={{ left: Math.min(Math.max(x(hover) + 12, 0), width - 160), top: 8 }}>
              <div className="text-slate-500">{active.label}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-block h-0.5 w-3" style={{ background: "var(--viz-series-1)" }} />
                <span className="text-sm font-semibold tabular-nums">{full(active.value)}</span>
              </div>
              <div className="text-slate-500">{seriesName}</div>
            </div>
          )}
        </div>
      )}
    </ChartCard>
  );
}

// ---------------------------------------------------------------- horizontal bars
export function BarList({
  title, subtitle, valueName, items, unit = "money", showShare = false, empty = "No data for this period.",
}: {
  // `unit` (not a formatter function) because these props cross the server/client boundary and must be serializable.
  title: string; subtitle?: string; valueName: string; items: { label: string; value: number; note?: string }[]; unit?: "money" | "units"; showShare?: boolean; empty?: string;
}) {
  const format = (n: number) => (unit === "units" ? `${ugx.format(n)} units` : full(n));
  const [view, setView] = useState<"chart" | "table">("chart");
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0);
  const share = (v: number) => (total > 0 ? `${((v / total) * 100).toFixed(1)}%` : "0%");

  return (
    <ChartCard title={title} subtitle={subtitle} toolbar={<ViewToggle view={view} onChange={setView} />}>
      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">{empty}</p>
      ) : view === "table" ? (
        <DataTable head={["Name", valueName, ...(showShare ? ["Share"] : [])]} rows={items.map((i) => [i.label, format(i.value), ...(showShare ? [share(i.value)] : [])])} />
      ) : (
        <ul className="space-y-2.5">
          {items.map((it) => (
            <li key={it.label} tabIndex={0} className="group relative grid grid-cols-[minmax(7rem,38%)_1fr] items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-100">
              <span className="truncate text-sm text-slate-700" title={it.label}>{it.label}</span>
              <div className="flex items-center gap-2">
                <div className="h-4 rounded-r-[4px] bg-[var(--viz-series-1)] transition-colors group-hover:bg-[var(--viz-series-1-hover)] group-focus-visible:bg-[var(--viz-series-1-hover)]"
                  style={{ width: `${Math.max(1.5, (it.value / max) * (showShare ? 66 : 82))}%` }} />
                <span className="whitespace-nowrap text-xs font-medium tabular-nums text-slate-700">{format(it.value)}{showShare && <span className="ml-1 font-normal text-slate-500">· {share(it.value)}</span>}</span>
              </div>
              <div role="tooltip" className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden min-w-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg group-hover:block group-focus-visible:block">
                <div className="font-medium text-slate-900">{it.label}</div>
                <div className="mt-1 flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--viz-series-1)" }} /><span className="text-sm font-semibold tabular-nums">{format(it.value)}</span></div>
                <div className="text-slate-500">{valueName}{showShare ? ` · ${share(it.value)} of total` : ""}{it.note ? ` · ${it.note}` : ""}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
