import "server-only";
import type { InvoiceData } from "@/components/invoice-view";
import { getPlatformSettings } from "@/lib/billing";
import { asPlatform } from "@/lib/tenant";

/** Everything printed on an invoice. `from` is read at platform level, because shops can't see the owner's settings table. */
export async function invoiceFrom() {
  const s = await asPlatform((tx) => getPlatformSettings(tx));
  return { businessName: s.businessName, address: s.address, phone: s.phone, email: s.email, paymentInstructions: s.paymentInstructions, invoiceFooter: s.invoiceFooter } satisfies InvoiceData["from"];
}
