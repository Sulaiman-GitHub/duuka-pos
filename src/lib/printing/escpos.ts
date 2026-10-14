import { formatMoney } from "@/lib/money";
import type { ReceiptData } from "./types";

// ESC/POS is the command language almost every small thermal receipt printer understands. This builds the bytes for a
// receipt; sending them is the transport's job (USB / Bluetooth) and is kept separate so this part can be tested.

const ESC = 0x1b, GS = 0x1d, LF = 0x0a;

/** Thermal printers speak a single-byte code page, not Unicode: keep plain ASCII and swap look-alikes. */
export function toPrinterText(s: string): string {
  return s
    .replace(/[−–—]/g, "-").replace(/×/g, "x").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...").replace(/·/g, "-")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, "?");
}

export const charsPerLine = (widthMm: 58 | 80) => (widthMm === 58 ? 32 : 48);

function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of toPrinterText(text).split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      let w = word;
      while (w.length > width) { // a single very long word
        if (line) { out.push(line); line = ""; }
        out.push(w.slice(0, width)); w = w.slice(width);
      }
      if (!line) line = w;
      else if (line.length + 1 + w.length <= width) line += " " + w;
      else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}

const center = (t: string, width: number) => wrap(t, width).map((l) => " ".repeat(Math.max(0, Math.floor((width - l.length) / 2))) + l);
function pair(left: string, right: string, width: number) {
  const l = toPrinterText(left), r = toPrinterText(right);
  const gap = width - l.length - r.length;
  return gap >= 1 ? l + " ".repeat(gap) + r : [...wrap(l, width), " ".repeat(Math.max(0, width - r.length)) + r].join("\n");
}

export function receiptToEscPos(r: ReceiptData): Uint8Array {
  const w = charsPerLine(r.widthMm);
  const m = (n: number) => formatMoney(n, r.currency);
  const bytes: number[] = [];
  const raw = (...b: number[]) => bytes.push(...b);
  const text = (t: string) => { for (const ch of t) bytes.push(ch.charCodeAt(0)); raw(LF); };
  const rule = () => text("-".repeat(w));

  raw(ESC, 0x40); // initialise
  raw(ESC, 0x61, 1); // centre
  raw(ESC, 0x45, 1, GS, 0x21, 0x11); // bold, double size
  for (const l of center(r.shopName, Math.floor(w / 2))) text(l);
  raw(GS, 0x21, 0x00, ESC, 0x45, 0);
  for (const l of [...center(r.address, w), ...center(r.phone, w)]) if (l.trim()) text(l);
  raw(ESC, 0x61, 0); // left
  rule();
  text(pair("Receipt", r.ref, w));
  if (r.refNote) text(toPrinterText(r.refNote));
  text(pair("Date", r.dateText, w));
  text(pair("Cashier", r.cashier, w));
  if (r.customer) text(pair("Customer", r.customer, w));
  if (r.status) text(toPrinterText(r.status));
  rule();
  for (const it of r.lines) {
    for (const l of wrap(it.name, w)) text(l);
    text(pair(`  ${it.quantity} x ${it.unitPrice.toLocaleString("en-US")}`, it.lineTotal.toLocaleString("en-US"), w));
  }
  rule();
  text(pair("Subtotal", m(r.subtotal), w));
  if (r.discount > 0) text(pair("Discount", "-" + m(r.discount), w));
  raw(ESC, 0x45, 1, GS, 0x21, 0x01);
  text(pair("TOTAL", m(r.total), w)); // double height only, so the full line width still applies
  raw(GS, 0x21, 0x00, ESC, 0x45, 0);
  text(pair(`Paid (${r.paymentLabel})`, m(r.paid), w));
  if (r.change > 0) text(pair("Change", m(r.change), w));
  if (r.reference) text(pair("Ref", r.reference, w));
  if (r.refunded) text(pair("Refunded", "-" + m(r.refunded), w));
  rule();
  raw(ESC, 0x61, 1);
  for (const l of center(r.footer, w)) text(l);
  raw(ESC, 0x64, 4); // feed a few lines
  raw(GS, 0x56, 0x42, 0x00); // partial cut (ignored by printers without a cutter)
  return Uint8Array.from(bytes);
}
