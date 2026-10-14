import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";

export type InvoiceData = {
  number: string; status: "UNPAID" | "PAID" | "VOID"; issuedAt: Date; dueDate: Date; periodStart: Date; periodEnd: Date;
  description: string; amount: number; currency: string; notes?: string | null;
  paidAt?: Date | null; paymentMethod?: string | null; paymentReference?: string | null;
  from: { businessName: string; address: string; phone: string; email: string; paymentInstructions: string; invoiceFooter: string };
  to: { name: string; address: string; phone: string };
};

/** A printable A4 invoice, shared by the platform owner's view and the shop administrator's view. */
export function InvoiceView({ inv }: { inv: InvoiceData }) {
  const total = formatMoney(inv.amount, inv.currency);
  return (
    <article className="receipt-print mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-900 shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-xl font-bold">{inv.from.businessName || "Duuka POS"}</h1>
          <div className="mt-1 space-y-0.5 text-slate-600">
            {inv.from.address && <p>{inv.from.address}</p>}
            {inv.from.phone && <p>{inv.from.phone}</p>}
            {inv.from.email && <p>{inv.from.email}</p>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tracking-wide">INVOICE</div>
          <div className="mt-1 font-mono">{inv.number}</div>
          <div className={`mt-2 inline-block rounded border px-2 py-0.5 text-xs font-semibold ${inv.status === "PAID" ? "border-emerald-600 text-emerald-700" : inv.status === "VOID" ? "border-slate-400 text-slate-500" : "border-amber-600 text-amber-700"}`}>
            {inv.status === "PAID" ? "PAID" : inv.status === "VOID" ? "CANCELLED" : "UNPAID"}
          </div>
        </div>
      </header>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Billed to</div>
          <p className="mt-1 font-medium">{inv.to.name}</p>
          {inv.to.address && <p className="text-slate-600">{inv.to.address}</p>}
          {inv.to.phone && <p className="text-slate-600">{inv.to.phone}</p>}
        </div>
        <dl className="space-y-1 sm:text-right">
          <div className="flex justify-between gap-4 sm:justify-end"><dt className="text-slate-500">Issued</dt><dd className="w-28 text-right">{formatDate(inv.issuedAt)}</dd></div>
          <div className="flex justify-between gap-4 sm:justify-end"><dt className="text-slate-500">Due</dt><dd className="w-28 text-right">{formatDate(inv.dueDate)}</dd></div>
          {inv.paidAt && <div className="flex justify-between gap-4 sm:justify-end"><dt className="text-slate-500">Paid</dt><dd className="w-28 text-right">{formatDate(inv.paidAt)}</dd></div>}
        </dl>
      </section>

      <table className="mt-8 w-full">
        <thead><tr className="border-b-2 border-slate-800 text-left text-xs uppercase tracking-wide"><th className="pb-2">Description</th><th className="pb-2">Period</th><th className="pb-2 text-right">Amount</th></tr></thead>
        <tbody>
          <tr className="border-b border-slate-200 align-top">
            <td className="py-3 pr-4">{inv.description}</td>
            <td className="py-3 pr-4 whitespace-nowrap text-slate-600">{formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}</td>
            <td className="py-3 text-right whitespace-nowrap">{total}</td>
          </tr>
        </tbody>
        <tfoot><tr><td colSpan={2} className="pt-3 text-right font-semibold">Total due</td><td className="pt-3 text-right text-lg font-bold whitespace-nowrap">{inv.status === "PAID" ? formatMoney(0, inv.currency) : total}</td></tr></tfoot>
      </table>

      {inv.status === "PAID" && (
        <p className="mt-4 rounded bg-emerald-50 px-3 py-2 text-emerald-800 print:bg-transparent print:px-0">
          Paid in full{inv.paymentMethod ? ` by ${inv.paymentMethod}` : ""}{inv.paymentReference ? `, reference ${inv.paymentReference}` : ""}. Thank you.
        </p>
      )}
      {inv.status === "UNPAID" && inv.from.paymentInstructions && (
        <section className="mt-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">How to pay</div>
          <p className="mt-1 whitespace-pre-line">{inv.from.paymentInstructions}</p>
          <p className="mt-1 text-slate-500">Please quote {inv.number} as the reference.</p>
        </section>
      )}
      {inv.notes && <p className="mt-4 whitespace-pre-line text-slate-600">{inv.notes}</p>}
      {inv.from.invoiceFooter && <footer className="mt-8 border-t border-slate-200 pt-3 text-center text-xs text-slate-500">{inv.from.invoiceFooter}</footer>}
    </article>
  );
}
