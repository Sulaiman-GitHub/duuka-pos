"use client";

import clsx from "clsx";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Alert, Button, inputCls } from "@/components/ui";
import { formatUGX } from "@/lib/money";
import { completeSale } from "./actions";
import { useHeldSales, type HeldSale } from "./held";

type Product = { id: string; name: string; sku: string; barcode: string | null; sellPrice: number; stock: number; categoryId: string | null; hasImage: boolean };
type Method = "CASH" | "MOBILE_MONEY" | "CARD" | "BANK_TRANSFER";

const METHODS: { key: Method; label: string }[] = [
  { key: "CASH", label: "Cash" },
  { key: "MOBILE_MONEY", label: "Mobile Money" },
  { key: "CARD", label: "Card" },
  { key: "BANK_TRANSFER", label: "Bank transfer" },
];

export function PosTerminal({ products, categories, maxDiscountPercent }: { products: Product[]; categories: { id: string; name: string }[]; maxDiscountPercent: number }) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [method, setMethod] = useState<Method>("CASH");
  const [tendered, setTendered] = useState("");
  const [reference, setReference] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const { held, hold, remove: removeHeld } = useHeldSales();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const lines = Object.entries(cart).map(([id, quantity]) => ({ p: byId.get(id)!, quantity })).filter((l) => l.p);
  const subtotal = lines.reduce((s, l) => s + l.p.sellPrice * l.quantity, 0);
  const dv = Math.max(0, Number(discountValue) || 0);
  const discount = Math.min(subtotal, discountType === "percent" ? Math.round((subtotal * dv) / 100) : Math.round(dv));
  const total = subtotal - discount;
  const paid = method === "CASH" ? Number(tendered) || 0 : total;
  const change = method === "CASH" ? Math.max(0, paid - total) : 0;
  const discountTooHigh = discount > (subtotal * maxDiscountPercent) / 100;
  const canPay = lines.length > 0 && !discountTooHigh && (method !== "CASH" || paid >= total) && !pending;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => (!category || p.categoryId === category) && (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode === query.trim()));
  }, [products, query, category]);

  function add(p: Product) {
    setError(undefined);
    setCart((c) => {
      const next = (c[p.id] ?? 0) + 1;
      if (next > p.stock) { setError(`Only ${p.stock} of "${p.name}" in stock.`); return c; }
      return { ...c, [p.id]: next };
    });
  }
  function setQty(id: string, q: number) {
    const p = byId.get(id);
    if (!p) return;
    setError(undefined);
    if (q <= 0) return setCart((c) => Object.fromEntries(Object.entries(c).filter(([k]) => k !== id)));
    if (q > p.stock) { setError(`Only ${p.stock} of "${p.name}" in stock.`); q = p.stock; }
    setCart((c) => ({ ...c, [id]: q }));
  }
  function clearAll() {
    setCart({}); setDiscountValue(""); setTendered(""); setReference(""); setCustomerName(""); setCustomerPhone(""); setError(undefined);
    searchRef.current?.focus();
  }

  function holdSale() {
    if (lines.length === 0) return;
    hold({ cart, discountType, discountValue, customerName, customerPhone });
    clearAll();
  }
  function resume(h: HeldSale) {
    if (lines.length > 0 && !confirm("Replace the sale you are working on? It will not be saved.")) return;
    // Only restore products that still exist; stock is re-checked by the server when the sale is completed.
    setCart(Object.fromEntries(Object.entries(h.cart).filter(([id]) => byId.has(id))));
    setDiscountType(h.discountType); setDiscountValue(h.discountValue); setCustomerName(h.customerName); setCustomerPhone(h.customerPhone);
    setTendered(""); setError(undefined);
    removeHeld(h.id);
  }

  function onSearchKey(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // Barcode scanners type the code then press Enter: exact barcode/SKU match wins, else a single search hit.
    const exact = products.find((p) => p.barcode === q || p.sku.toLowerCase() === q.toLowerCase());
    const target = exact ?? (filtered.length === 1 ? filtered[0] : undefined);
    if (target && target.stock > 0) { add(target); setQuery(""); }
    else if (target) setError(`"${target.name}" is out of stock.`);
    else setError("No single matching product. Refine the search or tap a product.");
  }

  function pay() {
    setError(undefined);
    start(async () => {
      const r = await completeSale({
        items: lines.map((l) => ({ productId: l.p.id, quantity: l.quantity })),
        discountType, discountValue: dv, paymentMethod: method, amountPaid: paid,
        customerName: customerName || undefined, customerPhone: customerPhone || undefined, reference: reference || undefined,
      });
      if (r.error) setError(r.error);
      else if (r.saleId) router.push(`/sales/${r.saleId}?new=1`);
    });
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "F9") { e.preventDefault(); if (canPay) pay(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const quick = total > 0 ? [...new Set([total, Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000])].slice(0, 4) : [];

  return (
    <div className="grid gap-4 pb-20 xl:grid-cols-[1fr_26rem] xl:pb-0">
      <section className="min-w-0">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={18} />
          <input ref={searchRef} autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onSearchKey}
            placeholder="Search by name or SKU, or scan a barcode…  (F2)" className={`${inputCls} pl-10`} />
        </div>
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {[{ id: "", name: "All" }, ...categories].map((c) => (
            <button key={c.id} onClick={() => setCategory(c.id)} className={clsx("whitespace-nowrap rounded-full border px-3 py-1 text-sm", category === c.id ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300 bg-white hover:bg-slate-50")}>{c.name}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => (
            <button key={p.id} disabled={p.stock === 0} onClick={() => add(p)}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-brand-500 hover:shadow disabled:cursor-not-allowed disabled:opacity-50">
              {p.hasImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/products/${p.id}/image`} alt="" loading="lazy" className="mb-2 aspect-[3/2] w-full rounded-lg object-cover" />
              ) : (
                <div className="mb-2 flex aspect-[3/2] w-full items-center justify-center rounded-lg bg-slate-100 text-lg font-semibold text-slate-400">{p.name.slice(0, 2).toUpperCase()}</div>
              )}
              <span className="line-clamp-2 min-h-[2.5rem] text-sm font-medium">{p.name}</span>
              <span className="mt-1 text-sm font-semibold text-brand-600">{formatUGX(p.sellPrice)}</span>
              <span className={clsx("text-xs", p.stock === 0 ? "text-red-600" : p.stock <= 5 ? "text-amber-600" : "text-slate-500")}>{p.stock === 0 ? "Out of stock" : `${p.stock} in stock`}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="col-span-full py-10 text-center text-sm text-slate-500">No products found.</p>}
        </div>
      </section>

      <aside id="cart" className="h-fit scroll-mt-4 rounded-xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">Current sale</h2>
          <div className="flex items-center gap-3 text-sm">
            {lines.length > 0 && <button onClick={holdSale} className="text-brand-600 hover:underline">Hold</button>}
            {lines.length > 0 && <button onClick={clearAll} className="text-red-600 hover:underline">Clear</button>}
          </div>
        </div>
        {held.length > 0 && (
          <details className="border-b border-slate-200 bg-amber-50/60 px-4 py-2 text-sm">
            <summary className="cursor-pointer font-medium text-amber-800">Held sales ({held.length})</summary>
            <ul className="mt-2 space-y-1.5">
              {held.map((h) => {
                const n = Object.values(h.cart).reduce((a, b) => a + b, 0);
                const sum = Object.entries(h.cart).reduce((t, [id, q]) => t + (byId.get(id)?.sellPrice ?? 0) * q, 0);
                return (
                  <li key={h.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{h.customerName || "Walk-in"} · {n} item{n === 1 ? "" : "s"} · {formatUGX(sum)}</span>
                    <span className="flex shrink-0 gap-2">
                      <button onClick={() => resume(h)} className="text-brand-600 hover:underline">Resume</button>
                      <button onClick={() => { if (confirm("Discard this held sale?")) removeHeld(h.id); }} className="text-red-600 hover:underline">Discard</button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </details>
        )}
        <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
          {lines.map(({ p, quantity }) => (
            <div key={p.id} className="flex items-center gap-2 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.name}</div>
                <div className="text-xs text-slate-500">{formatUGX(p.sellPrice)} each</div>
              </div>
              <div className="flex items-center gap-1">
                <button aria-label="Decrease" onClick={() => setQty(p.id, quantity - 1)} className="rounded border p-1 hover:bg-slate-50"><Minus size={14} /></button>
                <input aria-label="Quantity" value={quantity} onChange={(e) => setQty(p.id, parseInt(e.target.value, 10) || 0)} className="w-10 rounded border py-1 text-center text-sm" inputMode="numeric" />
                <button aria-label="Increase" onClick={() => setQty(p.id, quantity + 1)} className="rounded border p-1 hover:bg-slate-50"><Plus size={14} /></button>
              </div>
              <div className="w-24 text-right text-sm font-medium">{formatUGX(p.sellPrice * quantity)}</div>
              <button aria-label="Remove" onClick={() => setQty(p.id, 0)} className="text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ))}
          {lines.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">Tap a product or scan a barcode to start a sale.</p>}
        </div>

        <div className="space-y-3 border-t border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Discount</span>
            <input value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} inputMode="decimal" placeholder="0" className={`${inputCls} !w-24 !py-1`} />
            <select value={discountType} onChange={(e) => setDiscountType(e.target.value as "amount" | "percent")} className={`${inputCls} !w-20 !py-1`}>
              <option value="amount">UGX</option><option value="percent">%</option>
            </select>
          </div>
          {discountTooHigh && <p className="text-xs text-red-600">Cashiers can discount at most {maxDiscountPercent}%.</p>}
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600">Subtotal</dt><dd>{formatUGX(subtotal)}</dd></div>
            {discount > 0 && <div className="flex justify-between"><dt className="text-slate-600">Discount</dt><dd className="text-red-600">− {formatUGX(discount)}</dd></div>}
            <div className="flex justify-between border-t pt-2 text-lg font-semibold"><dt>Total</dt><dd>{formatUGX(total)}</dd></div>
          </dl>

          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => (
              <button key={m.key} onClick={() => setMethod(m.key)} className={clsx("rounded-lg border px-2 py-2 text-sm font-medium", method === m.key ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-300 hover:bg-slate-50")}>{m.label}</button>
            ))}
          </div>
          {method === "CASH" ? (
            <div className="space-y-2">
              <input value={tendered} onChange={(e) => setTendered(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="Cash received" className={inputCls} />
              <div className="flex flex-wrap gap-1">
                {quick.map((q) => <button key={q} onClick={() => setTendered(String(q))} className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-slate-50">{q === total ? "Exact" : q.toLocaleString()}</button>)}
              </div>
              {paid > 0 && <div className="flex justify-between text-sm"><span className="text-slate-600">Change</span><span className="font-semibold">{formatUGX(change)}</span></div>}
            </div>
          ) : (
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === "MOBILE_MONEY" ? "Transaction ID (optional)" : "Reference (optional)"} className={inputCls} />
          )}
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-600">Customer details (optional)</summary>
            <div className="mt-2 space-y-2">
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Name" className={inputCls} />
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone" className={inputCls} />
            </div>
          </details>
          {error && <Alert>{error}</Alert>}
          <Button onClick={pay} disabled={!canPay} className="w-full !py-3 text-base">{pending ? "Processing…" : `Complete sale · ${formatUGX(total)} (F9)`}</Button>
        </div>
      </aside>
      {lines.length > 0 && (
        <div className="no-print fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] xl:hidden">
          <div><div className="text-xs text-slate-500">{lines.reduce((a, l) => a + l.quantity, 0)} items</div><div className="text-lg font-semibold">{formatUGX(total)}</div></div>
          <Button onClick={() => document.getElementById("cart")?.scrollIntoView({ behavior: "smooth" })}>Review &amp; pay</Button>
        </div>
      )}
    </div>
  );
}
