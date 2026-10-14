import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader, inputCls, td, tdNum, th, Button } from "@/components/ui";
import { db } from "@/lib/db";
import { pageGuard } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { formatNumber, formatUGX } from "@/lib/money";
import type { Prisma } from "@/generated/prisma/client";
import { RowActions } from "./row-actions";

export const metadata: Metadata = { title: "Products" };
const PAGE_SIZE = 20;

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const user = await pageGuard("inventory.view");
  const canManage = can(user.role, "products.manage");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const status = typeof sp.status === "string" ? sp.status : "active";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.ProductWhereInput = {
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }, { barcode: { contains: q } }] }),
    ...(category && { categoryId: category }),
    ...(status === "active" && { isActive: true }),
    ...(status === "inactive" && { isActive: false }),
  };

  const [products, total, categories] = await Promise.all([
    db.product.findMany({
      where, orderBy: { name: "asc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      select: { id: true, name: true, sku: true, stock: true, minStock: true, costPrice: true, sellPrice: true, isActive: true, imageType: true, category: { select: { name: true } } },
    }),
    db.product.count({ where }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => new URLSearchParams({ ...(q && { q }), ...(category && { category }), status, page: String(p) }).toString();

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={`${formatNumber(total)} product${total === 1 ? "" : "s"}`}
        actions={canManage && (
          <>
            <Link href="/products/categories" className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Categories</Link>
            <Link href="/products/new" className="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">+ New product</Link>
          </>
        )}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, SKU or barcode…" className={`${inputCls} max-w-xs`} />
        <select name="category" defaultValue={category} className={`${inputCls} max-w-[12rem]`}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="status" defaultValue={status} className={`${inputCls} max-w-[10rem]`}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className={th}>Product</th><th className={th}>Category</th><th className={`${th} text-right`}>Cost</th>
              <th className={`${th} text-right`}>Price</th><th className={`${th} text-right`}>Stock</th><th className={th}>Status</th>
              {canManage && <th className={th} />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className={td}>
                  <div className="flex items-center gap-3">
                    {p.imageType ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/products/${p.id}/image`} alt="" className="h-10 w-10 rounded-lg border object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">{p.name.slice(0, 2).toUpperCase()}</div>
                    )}
                    <div><div className="font-medium">{p.name}</div><div className="text-xs text-slate-500">{p.sku}</div></div>
                  </div>
                </td>
                <td className={td}>{p.category?.name ?? "—"}</td>
                <td className={tdNum}>{formatUGX(p.costPrice)}</td>
                <td className={tdNum}>{formatUGX(p.sellPrice)}</td>
                <td className={tdNum}>
                  {p.stock === 0 ? <Badge tone="red">Out of stock</Badge> : p.stock <= p.minStock ? <Badge tone="amber">Low: {p.stock}</Badge> : formatNumber(p.stock)}
                </td>
                <td className={td}>{p.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
                {canManage && <td className={td}><RowActions id={p.id} name={p.name} isActive={p.isActive} /></td>}
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">No products match your filters.</td></tr>}
          </tbody>
        </table>
      </Card>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={`/products?${qs(page - 1)}`} className="rounded-lg border bg-white px-3 py-1.5 hover:bg-slate-50">Previous</Link>}
            {page < pages && <Link href={`/products?${qs(page + 1)}`} className="rounded-lg border bg-white px-3 py-1.5 hover:bg-slate-50">Next</Link>}
          </div>
        </div>
      )}
    </>
  );
}
