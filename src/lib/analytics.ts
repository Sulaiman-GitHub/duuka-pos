import "server-only";
import { db } from "@/lib/db";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { addDays, kampalaDateString, startOfKampalaDay } from "@/lib/time";

/**
 * Money definitions used everywhere (dashboard, reports, CSV):
 *   net sales    = sale total - refunds issued against that sale
 *   COGS         = unit cost of the items that were NOT returned
 *   gross profit = net sales - COGS
 * Returned items are assumed to go back to stock, so their cost is reversed along with the revenue.
 */
export type SaleFact = {
  id: string;
  at: Date;
  day: string; // yyyy-mm-dd, Kampala
  total: number;
  discount: number;
  refunded: number;
  cogs: number;
  method: PaymentMethod;
  cashierId: string;
};

export const net = (f: Pick<SaleFact, "total" | "refunded">) => f.total - f.refunded;

export async function saleFacts(from: Date, toExclusive: Date): Promise<SaleFact[]> {
  const rows = await db.$queryRaw<
    { id: string; createdAt: Date; total: number; discount: number; paymentMethod: PaymentMethod; cashierId: string; refunded: number; cogs: bigint }[]
  >`
    SELECT s.id, s."createdAt", s.total, s.discount, s."paymentMethod", s."cashierId",
           COALESCE(r.refunded, 0)::int AS refunded,
           COALESCE(c.cogs, 0)::bigint AS cogs
    FROM "Sale" s
    LEFT JOIN (SELECT "saleId", SUM("refundTotal") AS refunded FROM "SaleReturn" GROUP BY "saleId") r ON r."saleId" = s.id
    LEFT JOIN (
      SELECT si."saleId", SUM(si."unitCost"::bigint * (si.quantity - COALESCE(rt.q, 0))) AS cogs
      FROM "SaleItem" si
      LEFT JOIN (SELECT "saleItemId", SUM(quantity) AS q FROM "SaleReturnItem" GROUP BY "saleItemId") rt ON rt."saleItemId" = si.id
      GROUP BY si."saleId"
    ) c ON c."saleId" = s.id
    WHERE s."createdAt" >= ${from} AND s."createdAt" < ${toExclusive}
    ORDER BY s."createdAt"`;
  return rows.map((r) => ({
    id: r.id, at: r.createdAt, day: kampalaDateString(r.createdAt), total: r.total, discount: r.discount,
    refunded: r.refunded, cogs: Number(r.cogs), method: r.paymentMethod, cashierId: r.cashierId,
  }));
}

export type Totals = { transactions: number; gross: number; refunds: number; net: number; cogs: number; profit: number; discount: number };

export function sumFacts(facts: SaleFact[]): Totals {
  const t: Totals = { transactions: facts.length, gross: 0, refunds: 0, net: 0, cogs: 0, profit: 0, discount: 0 };
  for (const f of facts) {
    t.gross += f.total; t.refunds += f.refunded; t.cogs += f.cogs; t.discount += f.discount;
  }
  t.net = t.gross - t.refunds;
  t.profit = t.net - t.cogs;
  return t;
}

// ---- date helpers (all in Kampala days) ----
const dayMs = 86400000;
/** Every yyyy-mm-dd from `from` (a Kampala day start) through the day before `toExclusive`. */
export function daysBetween(from: Date, toExclusive: Date) {
  const out: string[] = [];
  for (let d = from; d < toExclusive; d = addDays(d, 1)) out.push(kampalaDateString(d));
  return out;
}

export type Grain = "day" | "week" | "month";

/** Bucket key + label for a yyyy-mm-dd day. Weeks start on Monday. */
export function bucketOf(day: string, grain: Grain): { key: string; label: string } {
  if (grain === "day") return { key: day, label: day };
  const d = new Date(day + "T00:00:00Z");
  if (grain === "month") return { key: day.slice(0, 7), label: day.slice(0, 7) };
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  const monday = new Date(d.getTime() - dow * dayMs).toISOString().slice(0, 10);
  return { key: monday, label: `Week of ${monday}` };
}

export function groupByGrain(facts: SaleFact[], from: Date, toExclusive: Date, grain: Grain) {
  const buckets = new Map<string, { label: string; facts: SaleFact[] }>();
  // Zero-fill so quiet days still appear in the table and the trend line.
  for (const day of daysBetween(from, toExclusive)) {
    const b = bucketOf(day, grain);
    if (!buckets.has(b.key)) buckets.set(b.key, { label: b.label, facts: [] });
  }
  for (const f of facts) {
    const b = bucketOf(f.day, grain);
    buckets.get(b.key)?.facts.push(f);
  }
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => ({ key, label: v.label, ...sumFacts(v.facts) }));
}

export type ProductSales = { id: string; name: string; sku: string; units: number; revenue: number; profit: number };

/** Best sellers by units, net of returns. Revenue is after the sale-level discount, like refunds. */
export async function bestSellers(from: Date, toExclusive: Date, limit = 50): Promise<ProductSales[]> {
  const rows = await db.$queryRaw<{ id: string; name: string; sku: string; units: number; revenue: number; cost: number }[]>`
    SELECT si."productId" AS id, MAX(si."productName") AS name, MAX(si.sku) AS sku,
           SUM(si.quantity - COALESCE(rt.q, 0))::int AS units,
           ROUND(SUM(si."unitPrice" * (si.quantity - COALESCE(rt.q, 0)) * (s.total::numeric / NULLIF(s.subtotal, 0))))::bigint::float8 AS revenue,
           SUM(si."unitCost"::bigint * (si.quantity - COALESCE(rt.q, 0)))::float8 AS cost
    FROM "SaleItem" si
    JOIN "Sale" s ON s.id = si."saleId"
    LEFT JOIN (SELECT "saleItemId", SUM(quantity) AS q FROM "SaleReturnItem" GROUP BY "saleItemId") rt ON rt."saleItemId" = si.id
    WHERE s."createdAt" >= ${from} AND s."createdAt" < ${toExclusive}
    GROUP BY si."productId"
    HAVING SUM(si.quantity - COALESCE(rt.q, 0)) > 0
    ORDER BY units DESC, revenue DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({ id: r.id, name: r.name, sku: r.sku, units: r.units, revenue: r.revenue, profit: r.revenue - r.cost }));
}

export async function lowStockCounts() {
  const [r] = await db.$queryRaw<{ low: bigint; out: bigint; total: bigint }[]>`
    SELECT COUNT(*) FILTER (WHERE stock > 0 AND stock <= "minStock") AS low,
           COUNT(*) FILTER (WHERE stock = 0) AS out,
           COUNT(*) AS total
    FROM "Product" WHERE "isActive" = true`;
  return { low: Number(r.low), out: Number(r.out), total: Number(r.total) };
}

export { startOfKampalaDay };
