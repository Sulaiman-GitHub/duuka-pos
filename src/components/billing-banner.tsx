import Link from "next/link";
import type { BillingInfo } from "@/lib/billing";

/** Tells a shop's administrators when the subscription is about to lapse or has. It never blocks them from working. */
export function BillingBanner({ info }: { info: BillingInfo }) {
  const late = info.state === "overdue" || info.state === "trial_ended";
  const text =
    info.state === "overdue" ? "Your subscription payment is overdue." :
    info.state === "trial_ended" ? "Your free trial has ended." :
    info.label + ".";
  return (
    <div className={`no-print mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-sm ${late ? "border-red-200 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-900"}`} role="status">
      <span className="font-medium">{text}</span>
      <span>{late ? "Please pay your latest invoice to avoid interruption." : "Check your invoice so the service continues without a break."}</span>
      <Link href="/billing" className="font-medium underline">View billing</Link>
    </div>
  );
}
