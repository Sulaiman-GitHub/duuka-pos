import "server-only";
import { bestSellers, groupByGrain, saleFacts, sumFacts, type Grain } from "@/lib/analytics";
import { db } from "@/lib/db";
import { addDays, kampalaDateString, parseKampalaDate, startOfKampalaDay } from "@/lib/time";

export type ReportType = "sales" | "profit" | "inventory" | "best-sellers" | "low-stock" | "by-cashier" | "by-payment";

export const REPORT_TYPES: { key: ReportType; label: string; dated: boolean; grain?: boolean }[] = [
  { key: "sales", label: "Sales", dated: true, grain: true },
  { key: "profit", label: "Profit", dated: true, grain: true },
  { key: "inventory", label: "Inventory", dated: false },
  { key: "best-sellers", label: "Best sellers", dated: true },
  { key: "low-stock", label: "Low stock", dated: false },
  { key: "by-cashier", label: "By cashier", dated: true },
  { key: "by-payment", label: "By payment method", dated: true },
];

export type Col = { key: string; label: string; kind: "text" | "money" | "int" | "pct" };
type Cell = string | number;
export type Report = { type: ReportType; title: string; note?: string; columns: Col[]; rows: Record<string, Cell>[]; totals?: Record<string, Cell> };

export type ReportParams = { type: ReportType; from: Date; toExclusive: Date; fromStr: string; toStr: string; grain: Grain };

export function parseReportParams(sp: Record<string, string | string[] | undefined>): ReportParams {
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const type = REPORT_TYPES.some((t) => t.key === str("type")) ? (str("type") as ReportType) : "sales";
  const today = startOfKampalaDay();
  let from = parseKampalaDate(str("from")) ?? addDays(today, -29);
  let to = parseKampalaDate(str("to")) ?? today; // inclusive last day
  if (to < from) [from, to] = [to, from];
  if (to > today) to = today;
  if (from > to) from = to;
  if ((to.getTime() - from.getTime()) / 86400000 > 366) from = addDays(to, -366);
  const grain = (["day", "week", "month"] as const).find((g) => g === str("grain")) ?? "day";
  return { type, from, toExclusive: addDays(to, 1), fromStr: kampalaDateString(from), toStr: kampalaDateString(to), grain };
}

const METHOD_LABEL: Record<string, string> = { CASH: "Cash", MOBILE_MONEY: "Mobile Money", CARD: "Card", BANK_TRANSFER: "Bank transfer" };
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

export async function buildReport(p: ReportParams): Promise<Report> {
  switch (p.type) {
    case "sales": {
      const facts = await saleFacts(p.from, p.toExclusive);
      const rows = groupByGrain(facts, p.from, p.toExclusive, p.grain);
      const t = sumFacts(facts);
      return {
        type: p.type, title: "Sales report",
        columns: [{ key: "period", label: p.grain === "day" ? "Date" : p.grain === "week" ? "Week" : "Month", kind: "text" }, { key: "transactions", label: "Transactions", kind: "int" }, { key: "gross", label: "Gross sales", kind: "money" }, { key: "discount", label: "Discounts given", kind: "money" }, { key: "refunds", label: "Refunds", kind: "money" }, { key: "net", label: "Net sales", kind: "money" }, { key: "avg", label: "Avg sale", kind: "money" }],
        rows: rows.map((r) => ({ period: r.label, transactions: r.transactions, gross: r.gross, discount: r.discount, refunds: r.refunds, net: r.net, avg: r.transactions ? Math.round(r.net / r.transactions) : 0 })),
        totals: { period: "Total", transactions: t.transactions, gross: t.gross, discount: t.discount, refunds: t.refunds, net: t.net, avg: t.transactions ? Math.round(t.net / t.transactions) : 0 },
      };
    }
    case "profit": {
      const facts = await saleFacts(p.from, p.toExclusive);
      const rows = groupByGrain(facts, p.from, p.toExclusive, p.grain);
      const t = sumFacts(facts);
      return {
        type: p.type, title: "Profit report",
        note: "Gross profit = net sales − cost of goods sold. Refunded items are assumed to return to stock, so their cost is reversed too.",
        columns: [{ key: "period", label: p.grain === "day" ? "Date" : p.grain === "week" ? "Week" : "Month", kind: "text" }, { key: "net", label: "Net sales", kind: "money" }, { key: "cogs", label: "Cost of goods", kind: "money" }, { key: "profit", label: "Gross profit", kind: "money" }, { key: "margin", label: "Margin (%)", kind: "pct" }],
        rows: rows.map((r) => ({ period: r.label, net: r.net, cogs: r.cogs, profit: r.profit, margin: pct(r.profit, r.net) })),
        totals: { period: "Total", net: t.net, cogs: t.cogs, profit: t.profit, margin: pct(t.profit, t.net) },
      };
    }
    case "inventory": {
      const products = await db.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { sku: true, name: true, stock: true, minStock: true, costPrice: true, sellPrice: true, category: { select: { name: true } } } });
      const rows = products.map((x) => ({ sku: x.sku, name: x.name, category: x.category?.name ?? "—", stock: x.stock, min: x.minStock, cost: x.costPrice, costValue: x.stock * x.costPrice, retailValue: x.stock * x.sellPrice, status: x.stock === 0 ? "Out of stock" : x.stock <= x.minStock ? "Low stock" : "OK" }));
      return {
        type: p.type, title: "Inventory report", note: "A snapshot of current stock — it does not depend on the date range.",
        columns: [{ key: "sku", label: "SKU", kind: "text" }, { key: "name", label: "Product", kind: "text" }, { key: "category", label: "Category", kind: "text" }, { key: "stock", label: "In stock", kind: "int" }, { key: "min", label: "Min level", kind: "int" }, { key: "cost", label: "Unit cost", kind: "money" }, { key: "costValue", label: "Value at cost", kind: "money" }, { key: "retailValue", label: "Value at retail", kind: "money" }, { key: "status", label: "Status", kind: "text" }],
        rows,
        totals: { sku: "", name: "Total", category: "", stock: rows.reduce((s, r) => s + r.stock, 0), min: "", cost: "", costValue: rows.reduce((s, r) => s + r.costValue, 0), retailValue: rows.reduce((s, r) => s + r.retailValue, 0), status: "" },
      };
    }
    case "best-sellers": {
      const top = await bestSellers(p.from, p.toExclusive, 50);
      return {
        type: p.type, title: "Best-selling products", note: "Ranked by units sold, net of returns. Revenue is after discounts. Top 50 products.",
        columns: [{ key: "rank", label: "#", kind: "int" }, { key: "name", label: "Product", kind: "text" }, { key: "sku", label: "SKU", kind: "text" }, { key: "units", label: "Units sold", kind: "int" }, { key: "revenue", label: "Revenue", kind: "money" }, { key: "profit", label: "Gross profit", kind: "money" }],
        rows: top.map((x, i) => ({ rank: i + 1, name: x.name, sku: x.sku, units: x.units, revenue: x.revenue, profit: x.profit })),
        totals: { rank: "", name: "Total", sku: "", units: top.reduce((s, x) => s + x.units, 0), revenue: top.reduce((s, x) => s + x.revenue, 0), profit: top.reduce((s, x) => s + x.profit, 0) },
      };
    }
    case "low-stock": {
      const rows = await db.$queryRaw<{ sku: string; name: string; category: string | null; stock: number; minStock: number; costPrice: number }[]>`
        SELECT p.sku, p.name, c.name AS category, p.stock, p."minStock", p."costPrice"
        FROM "Product" p LEFT JOIN "Category" c ON c.id = p."categoryId"
        WHERE p."isActive" = true AND p.stock <= p."minStock" ORDER BY p.stock ASC, p.name ASC`;
      return {
        type: p.type, title: "Low-stock report", note: "Products at or below their minimum level. Suggested reorder brings stock back to twice the minimum.",
        columns: [{ key: "sku", label: "SKU", kind: "text" }, { key: "name", label: "Product", kind: "text" }, { key: "category", label: "Category", kind: "text" }, { key: "stock", label: "In stock", kind: "int" }, { key: "min", label: "Min level", kind: "int" }, { key: "reorder", label: "Suggested reorder", kind: "int" }, { key: "cost", label: "Est. cost", kind: "money" }, { key: "status", label: "Status", kind: "text" }],
        rows: rows.map((x) => { const reorder = Math.max(0, x.minStock * 2 - x.stock); return { sku: x.sku, name: x.name, category: x.category ?? "—", stock: x.stock, min: x.minStock, reorder, cost: reorder * x.costPrice, status: x.stock === 0 ? "Out of stock" : "Low stock" }; }),
      };
    }
    case "by-cashier": {
      const facts = await saleFacts(p.from, p.toExclusive);
      const users = await db.user.findMany({ select: { id: true, name: true } });
      const rows = users.map((u) => ({ u, t: sumFacts(facts.filter((f) => f.cashierId === u.id)) })).filter((x) => x.t.transactions > 0).sort((a, b) => b.t.net - a.t.net);
      const all = sumFacts(facts);
      return {
        type: p.type, title: "Sales by cashier",
        columns: [{ key: "cashier", label: "Cashier", kind: "text" }, { key: "transactions", label: "Transactions", kind: "int" }, { key: "net", label: "Net sales", kind: "money" }, { key: "avg", label: "Avg sale", kind: "money" }, { key: "discount", label: "Discounts given", kind: "money" }, { key: "refunds", label: "Refunds", kind: "money" }, { key: "share", label: "Share (%)", kind: "pct" }],
        rows: rows.map(({ u, t }) => ({ cashier: u.name, transactions: t.transactions, net: t.net, avg: Math.round(t.net / t.transactions), discount: t.discount, refunds: t.refunds, share: pct(t.net, all.net) })),
        totals: { cashier: "Total", transactions: all.transactions, net: all.net, avg: all.transactions ? Math.round(all.net / all.transactions) : 0, discount: all.discount, refunds: all.refunds, share: all.net ? 100 : 0 },
      };
    }
    case "by-payment": {
      const facts = await saleFacts(p.from, p.toExclusive);
      const all = sumFacts(facts);
      const rows = Object.entries(METHOD_LABEL).map(([k, label]) => ({ label, t: sumFacts(facts.filter((f) => f.method === k)) })).filter((x) => x.t.transactions > 0).sort((a, b) => b.t.net - a.t.net);
      return {
        type: p.type, title: "Sales by payment method",
        columns: [{ key: "method", label: "Payment method", kind: "text" }, { key: "transactions", label: "Transactions", kind: "int" }, { key: "net", label: "Net sales", kind: "money" }, { key: "share", label: "Share (%)", kind: "pct" }],
        rows: rows.map(({ label, t }) => ({ method: label, transactions: t.transactions, net: t.net, share: pct(t.net, all.net) })),
        totals: { method: "Total", transactions: all.transactions, net: all.net, share: all.net ? 100 : 0 },
      };
    }
  }
}

// ---- CSV ----
const safe = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s); // stop spreadsheet formula injection
const esc = (v: Cell) => {
  const s = typeof v === "number" ? String(v) : safe(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(r: Report) {
  const lines = [r.columns.map((c) => esc(c.label)).join(",")];
  for (const row of r.rows) lines.push(r.columns.map((c) => esc(row[c.key] ?? "")).join(","));
  if (r.totals) lines.push(r.columns.map((c) => esc(r.totals![c.key] ?? "")).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n"; // BOM so Excel reads UTF-8
}

