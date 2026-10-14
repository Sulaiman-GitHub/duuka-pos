import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader, td, th } from "@/components/ui";
import { db } from "@/lib/db";
import { pageGuard } from "@/lib/guard";
import { formatDate, formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Users" };
const ROLE_TONE = { ADMIN: "blue", MANAGER: "amber", CASHIER: "slate" } as const;

export default async function UsersPage() {
  const me = await pageGuard("users.manage");
  const [users, lastLogins] = await Promise.all([
    db.user.findMany({ orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }], include: { _count: { select: { sales: true } } } }),
    db.auditLog.groupBy({ by: ["userId"], where: { action: "login.success" }, _max: { createdAt: true } }),
  ]);
  const last = new Map(lastLogins.map((l) => [l.userId, l._max.createdAt]));
  return (
    <>
      <PageHeader title="Users" subtitle="Staff accounts and what each role can do"
        actions={<Link href="/users/new" className="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">+ New user</Link>} />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-slate-200 bg-slate-50"><tr><th className={th}>Name</th><th className={th}>Role</th><th className={th}>Status</th><th className={th}>Last sign-in</th><th className={th}>Created</th><th className={th} /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className={td}><div className="font-medium">{u.name}{u.id === me.id && <span className="ml-2 text-xs text-slate-500">(you)</span>}</div><div className="text-xs text-slate-500">{u.email}</div></td>
                <td className={td}><Badge tone={ROLE_TONE[u.role]}>{u.role.charAt(0) + u.role.slice(1).toLowerCase()}</Badge></td>
                <td className={td}>{u.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
                <td className={`${td} whitespace-nowrap`}>{last.get(u.id) ? formatDateTime(last.get(u.id)!) : "Never"}</td>
                <td className={`${td} whitespace-nowrap`}>{formatDate(u.createdAt)}</td>
                <td className={`${td} text-right`}><Link href={`/users/${u.id}/edit`} className="text-brand-500 hover:underline">Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
