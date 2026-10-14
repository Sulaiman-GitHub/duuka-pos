import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Card, PageHeader, inputCls, td, tdNum, th } from "@/components/ui";
import { db } from "@/lib/db";
import { pageGuard } from "@/lib/guard";
import { formatNumber, formatUGX } from "@/lib/money";
import { can } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";
import { InventoryTabs } from "./tabs";

export const metadata: Metadata = { title: "Inventory" };
const PAGE_SIZE = 25;

function Stat({ label, value, tone }: { label: string; value: string; tone?: "red" | "amber" }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : ""}`}>{value}</div>
    </Card>
  );
}

export default async function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  const user = await pageGuard("inventory.view");
  const canAdjust = can(user.role, "inventory.adjust");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const filter = typeof sp.filter === "string" ? sp.filter : "all";
  const page = Math.max(1, Number(sp.page) || 1);

  const [val] = await db.$queryRaw<{ cost: bigint | null; retail: bigint | null; units: bigint | null }[]>`
    SELECT SUM(stock::bigint * "costPrice") AS cost, SUM(stock::bigint * "sellPrice") AS retail, SUM(stock)::bigint AS units
    FROM "Product" WHERE "isActive" = true`;
  const [low] = await db.$queryRaw<{ low: bigint; out: bigint }[]>`
    SELECT COUNT(*) FILTER (WHERE stock > 0 AND stock <= "minStock") AS low, COUNT(*) FILTER (WHERE stock = 0) AS out
    FROM "Product" WHERE "isActive" = true`;
  const cost = Number(val.cost ?? 0), retail = Number(val.retail ?? 0);

  // Prisma can't compare two columns in a filter, so low-stock rows are selected by id via SQL.
  let idFilter: Prisma.ProductWhereInput = {};
  if (filter === "low") {
    const ids = await db.$queryRaw<{ id: string }[]>`SELECT id FROM "Product" WHERE "isActive" = true AND stock > 0 AND stock <= "minStock"`;
    idFilter = { id: { in: ids.map((r) => r.id) } };
  } else if (filter === "out") idFilter = { stock: 0 };

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...idFilter,
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] }),
  };
  const [rows, total] = await Promise.all([
    db.product.findMany({
      where, orderBy: filter === "all" ? { name: "asc" } : { stock: "asc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      select: { id: true, name: true, sku: true, stock: true, minStock: true, costPrice: true, category: { select: { name: true } } },
    }),
    db.product.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => new URLSearchParams({ ...(q && { q }), filter, page: String(p) }).toString();

  return (
    <>
      <PageHeader title="Inventory" subtitle="Stock levels, valuation and alerts" />
      <InventoryTabs active="stock" canAdjust={canAdjust} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Units in stock" value={formatNumber(Number(val.units ?? 0))} />
        <Stat label="Value at cost" value={formatUGX(cost)} />
        <Stat label="Value at retail" value={formatUGX(retail)} />
        <Stat label="Low stock" value={String(low.low)} tone={Number(low.low) ? "amber" : undefined} />
        <Stat label="Out of stock" value={String(low.out)} tone={Number(low.out) ? "red" : undefined} />
      </div>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name or SKU…" className={`${inputCls} max-w-xs`} />
        <select name="filter" defaultValue={filter} className={`${inputCls} max-w-[12rem]`}>
          <option value="all">All products</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr><th className={th}>Product</th><th className={th}>Category</th><th className={`${th} text-right`}>In stock</th><th className={`${th} text-right`}>Min</th><th className={`${th} text-right`}>Value at cost</th><th className={th}>Status</th>{canAdjust && <th className={th} />}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className={td}><div className="font-medium">{p.name}</div><div className="text-xs text-slate-500">{p.sku}</div></td>
                <td className={td}>{p.category?.name ?? "—"}</td>
                <td className={tdNum}>{formatNumber(p.stock)}</td>
                <td className={tdNum}>{p.minStock}</td>
                <td className={tdNum}>{formatUGX(p.stock * p.costPrice)}</td>
                <td className={td}>{p.stock === 0 ? <Badge tone="red">Out of stock</Badge> : p.stock <= p.minStock ? <Badge tone="amber">Low stock</Badge> : <Badge tone="green">OK</Badge>}</td>
                {canAdjust && <td className={`${td} text-right`}><Link href={`/inventory/adjust?product=${p.id}`} className="text-brand-500 hover:underline">Adjust</Link></td>}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">Nothing to show.</td></tr>}
          </tbody>
        </table>
      </Card>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={`/inventory?${qs(page - 1)}`} className="rounded-lg border bg-white px-3 py-1.5 hover:bg-slate-50">Previous</Link>}
            {page < pages && <Link href={`/inventory?${qs(page + 1)}`} className="rounded-lg border bg-white px-3 py-1.5 hover:bg-slate-50">Next</Link>}
          </div>
        </div>
      )}
    </>
  );
}
