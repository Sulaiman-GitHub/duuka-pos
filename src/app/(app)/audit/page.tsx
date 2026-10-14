import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Card, PageHeader, inputCls, td, th } from "@/components/ui";
import { db } from "@/lib/db";
import { pageGuard } from "@/lib/guard";
import { addDays, formatDateTime, parseKampalaDate } from "@/lib/time";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Activity log" };
const PAGE_SIZE = 40;

const tone = (action: string) => (action.endsWith("failed") ? "red" : action.startsWith("login") ? "slate" : action.includes("delete") || action.includes("cancel") || action.includes("return") ? "amber" : "blue") as "red" | "slate" | "amber" | "blue";

export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  await pageGuard("audit.view");
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const action = str("action"), userId = str("user");
  const from = parseKampalaDate(str("from")), to = parseKampalaDate(str("to"));
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.AuditLogWhereInput = {
    ...(action && { action }), ...(userId && { userId }),
    ...((from || to) && { createdAt: { ...(from && { gte: from }), ...(to && { lt: addDays(to, 1) }) } }),
  };
  const [rows, total, actions, users] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { user: { select: { name: true } } } }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => new URLSearchParams(Object.entries({ action, user: userId, from: str("from"), to: str("to"), page: String(p) }).filter(([, v]) => v)).toString();

  return (
    <>
      <PageHeader title="Activity log" subtitle="A record of sign-ins and changes made in the system" />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <select name="action" defaultValue={action} className={`${inputCls} max-w-[13rem]`}>
          <option value="">All actions</option>
          {actions.map((a) => <option key={a.action} value={a.action}>{a.action}</option>)}
        </select>
        <select name="user" defaultValue={userId} className={`${inputCls} max-w-[12rem]`}>
          <option value="">All users</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <input type="date" name="from" defaultValue={str("from")} className={`${inputCls} max-w-[10rem]`} aria-label="From date" />
        <input type="date" name="to" defaultValue={str("to")} className={`${inputCls} max-w-[10rem]`} aria-label="To date" />
        <Button type="submit" variant="secondary">Filter</Button>
        <Link href="/audit" className="px-2 py-2 text-sm text-slate-500 hover:underline">Reset</Link>
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-slate-200 bg-slate-50"><tr><th className={th}>When</th><th className={th}>User</th><th className={th}>Action</th><th className={th}>Item</th><th className={th}>Details</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className={`${td} whitespace-nowrap`}>{formatDateTime(r.createdAt)}</td>
                <td className={td}>{r.user?.name ?? <span className="text-slate-400">—</span>}</td>
                <td className={td}><Badge tone={tone(r.action)}>{r.action}</Badge></td>
                <td className={`${td} text-slate-600`}>{r.entity ?? "—"}</td>
                <td className={`${td} max-w-xs truncate text-slate-600`} title={r.detail ?? ""}>{r.detail ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">No activity matches.</td></tr>}
          </tbody>
        </table>
      </Card>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">Page {page} of {pages} · {total.toLocaleString()} events</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={`/audit?${qs(page - 1)}`} className="rounded-lg border bg-white px-3 py-1.5 hover:bg-slate-50">Previous</Link>}
            {page < pages && <Link href={`/audit?${qs(page + 1)}`} className="rounded-lg border bg-white px-3 py-1.5 hover:bg-slate-50">Next</Link>}
          </div>
        </div>
      )}
    </>
  );
}
