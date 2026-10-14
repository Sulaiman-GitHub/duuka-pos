import { formatMoney } from "@/lib/money";
import type { ReceiptData } from "@/lib/printing/types";

/**
 * A receipt laid out for a narrow roll (58 mm or 80 mm), the same on screen and on paper. The `@page` rule removes the
 * browser's margins. (Browsers can't ask for "this wide, any height", so the paper size itself comes from the printer driver:
 * choose the roll size once in the print dialog and it is remembered.)
 */
export function ReceiptView({ data: r }: { data: ReceiptData }) {
  const m = (n: number) => formatMoney(n, r.currency);
  const small = r.widthMm === 58;
  return (
    <>
      <style>{`@page { margin: 0; }`}</style>
      <article
        className="receipt-print mx-auto bg-white font-mono text-black shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0"
        style={{ width: `${r.widthMm}mm`, padding: "3mm", fontSize: small ? "11px" : "12px", lineHeight: 1.35 }}
      >
        <header className="text-center">
          <h1 className="font-bold" style={{ fontSize: small ? "14px" : "16px" }}>{r.shopName}</h1>
          {r.address && <p>{r.address}</p>}
          {r.phone && <p>{r.phone}</p>}
        </header>
        <div className="my-2 space-y-0.5 border-y border-dashed border-black py-2">
          <Row l="Receipt" r={r.ref} bold />
          {r.refNote && <p className="text-[0.9em]">{r.refNote}</p>}
          <Row l="Date" r={r.dateText} />
          <Row l="Cashier" r={r.cashier} />
          {r.customer && <Row l="Customer" r={r.customer} />}
          {r.status && <p className="font-semibold">{r.status}</p>}
        </div>
        <div className="space-y-1">
          {r.lines.map((it, i) => (
            <div key={i}>
              <div className="break-words">{it.name}</div>
              <Row l={`  ${it.quantity} x ${it.unitPrice.toLocaleString("en-US")}`} r={it.lineTotal.toLocaleString("en-US")} />
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-0.5 border-t border-dashed border-black pt-2">
          <Row l="Subtotal" r={m(r.subtotal)} />
          {r.discount > 0 && <Row l="Discount" r={`- ${m(r.discount)}`} />}
          <div className="flex justify-between font-bold" style={{ fontSize: small ? "13px" : "15px" }}><span>TOTAL</span><span>{m(r.total)}</span></div>
          <Row l={`Paid (${r.paymentLabel})`} r={m(r.paid)} />
          {r.change > 0 && <Row l="Change" r={m(r.change)} />}
          {r.reference && <Row l="Ref" r={r.reference} />}
          {!!r.refunded && <Row l="Refunded" r={`- ${m(r.refunded)}`} />}
        </div>
        {r.footer && <p className="mt-3 text-center">{r.footer}</p>}
      </article>
    </>
  );
}

function Row({ l, r, bold }: { l: string; r: string; bold?: boolean }) {
  return <div className={`flex justify-between gap-2 ${bold ? "font-semibold" : ""}`}><span className="whitespace-pre">{l}</span><span className="text-right">{r}</span></div>;
}
