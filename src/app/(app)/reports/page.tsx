import type { Metadata } from "next";
import clsx from "clsx";
import { Download } from "lucide-react";
import Link from "next/link";
import { Button, Card, PageHeader, inputCls } from "@/components/ui";
import { pageGuard } from "@/lib/guard";
import { formatNumber, formatUGX } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { REPORT_TYPES, buildReport, parseReportParams, type Col } from "@/lib/reports";
import { addDays, formatDateTime, kampalaDateString, startOfKampalaDay } from "@/lib/time";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Reports" };

const fmt = (c: Col, v: string | number | undefined) => {
  if (v === undefined || v === "") return "";
  if (typeof v === "string") return v;
  return c.kind === "money" ? formatUGX(v) : c.kind === "pct" ? `${v}%` : formatNumber(v);
};

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  await pageGuard("reports.view");
  const sp = await searchParams;
  const p = parseReportParams(sp);
  const meta = REPORT_TYPES.find((t) => t.key === p.type)!;
  const [report, business] = await Promise.all([buildReport(p), getSettings()]);

  const today = startOfKampalaDay();
  const presets = [
    { label: "Today", from: today, to: today },
    { label: "Last 7 days", from: addDays(today, -6), to: today },
    { label: "Last 30 days", from: addDays(today, -29), to: today },
    { label: "Last 90 days", from: addDays(today, -89), to: today },
  ];
  const q = (o: Record<string, string>) => new URLSearchParams({ type: p.type, from: p.fromStr, to: p.toStr, grain: p.grain, ...o }).toString();
  const csvHref = `/api/reports/csv?${q({})}`;
  const right = (c: Col) => c.kind !== "text";

  return (
    <>
      <div className="no-print"><PageHeader title="Reports" subtitle="Filter by date, then export to CSV or save as a PDF" /></div>

      <div className="no-print mb-5 flex flex-wrap gap-1 border-b border-slate-200">
        {REPORT_TYPES.map((t) => (
          <Link key={t.key} href={`/reports?${q({ type: t.key })}`} className={clsx("-mb-px border-b-2 px-3 py-2 text-sm font-medium", t.key === p.type ? "border-brand-500 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-800")}>{t.label}</Link>
        ))}
      </div>

      <form className="no-print mb-5 flex flex-wrap items-end gap-2">
        <input type="hidden" name="type" value={p.type} />
        {meta.dated && (
          <>
            <input type="date" name="from" defaultValue={p.fromStr} max={kampalaDateString()} className={`${inputCls} max-w-[10rem]`} aria-label="From date" />
            <input type="date" name="to" defaultValue={p.toStr} max={kampalaDateString()} className={`${inputCls} max-w-[10rem]`} aria-label="To date" />
          </>
        )}
        {meta.grain && (
          <select name="grain" defaultValue={p.grain} className={`${inputCls} max-w-[10rem]`} aria-label="Group by">
            <option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option>
          </select>
        )}
        {meta.dated && <Button type="submit" variant="secondary">Apply</Button>}
        <div className="ml-auto flex gap-2">
          <a href={csvHref} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Download size={16} /> Export CSV</a>
          <PrintButton />
        </div>
      </form>
      {meta.dated && (
        <div className="no-print mb-4 flex flex-wrap gap-2 text-sm">
          {presets.map((x) => (
            <Link key={x.label} href={`/reports?${q({ from: kampalaDateString(x.from), to: kampalaDateString(x.to) })}`} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-600 hover:bg-slate-50">{x.label}</Link>
          ))}
        </div>
      )}

      <Card className="print:border-0 print:shadow-none">
        <header className="border-b border-slate-200 px-5 py-4">
          <div className="hidden text-xs text-slate-500 print:block">{business.name} · {business.address} · {business.phone}</div>
          <h2 className="text-lg font-semibold">{report.title}</h2>
          <p className="text-sm text-slate-500">
            {meta.dated ? `${p.fromStr} to ${p.toStr}` : "Current stock"} · Generated {formatDateTime(new Date())}
          </p>
          {report.note && <p className="mt-1 text-xs text-slate-500">{report.note}</p>}
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 print:bg-transparent">
              <tr>{report.columns.map((c) => <th key={c.key} className={clsx("px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500", right(c) ? "text-right" : "text-left")}>{c.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.rows.map((r, i) => (
                <tr key={i} className="print:break-inside-avoid">
                  {report.columns.map((c) => <td key={c.key} className={clsx("px-4 py-2", right(c) ? "whitespace-nowrap text-right tabular-nums" : "text-left")}>{fmt(c, r[c.key])}</td>)}
                </tr>
              ))}
              {report.rows.length === 0 && <tr><td colSpan={report.columns.length} className="px-4 py-10 text-center text-slate-500">No data for this period.</td></tr>}
            </tbody>
            {report.totals && report.rows.length > 0 && (
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold print:bg-transparent">
                <tr>{report.columns.map((c) => <td key={c.key} className={clsx("px-4 py-2.5", right(c) ? "whitespace-nowrap text-right tabular-nums" : "text-left")}>{fmt(c, report.totals![c.key])}</td>)}</tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </>
  );
}
