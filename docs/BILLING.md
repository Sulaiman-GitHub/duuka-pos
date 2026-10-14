# Billing (manual invoicing)

Duuka POS bills shops **by hand**, which is the simplest way to start: you agree a price with a shop, issue an invoice, and record the payment when it arrives (Mobile Money, bank, cash). Nothing talks to a payment provider yet.

## Once: your business details
Platform owner → **Billing** → *Your business details*: business name, contact details, **how shops should pay** (for example your Mobile Money number and name) and a footer. These print on every invoice. You can also set the free-trial length for new shops (default 30 days).

## For each shop
Platform owner → **Billing** → **Manage** (or open the shop and scroll to *Billing*).

1. **Plan**: name, price per month (in the shop's currency), how many active staff accounts it may have, and when its free trial ends.
2. **New invoice**: choose the number of months (the amount defaults to months × price, or type your own). The invoice covers the next period that isn't billed yet, so two invoices can never bill the same days, and the first one starts after any free trial.
3. When the shop pays: **Record payment** → method, reference (e.g. the Mobile Money transaction ID) and date. The shop is then covered until the end of that invoice's period. Cancelling an unpaid invoice is **Cancel**; a paid invoice stays on record.
4. **Print / save as PDF** from the invoice page to send it by WhatsApp or email.

## What shops see
Shop administrators have a **Billing** page: their plan, status, how to pay, and their invoices (printable). From 5 days before the end of cover, and after it, a banner reminds them. **Nothing is switched off automatically**: a late shop keeps working until *you* suspend it (Shops → Manage → Suspend).

## Staff limit
The plan's staff limit counts active accounts. Adding another (or re-activating one) beyond it shows a message asking them to deactivate someone or contact you.

## Status meanings
| Status | Meaning |
|---|---|
| Trial: N days left | Free trial running |
| Paid | Covered for more than 5 more days |
| Renewal due in N days | Cover ends within 5 days |
| Overdue by N days | Cover ended; the shop should pay |
| Trial ended N days ago | Never paid; trial is over |
| Free / Not yet invoiced | No price set / price set but nothing billed |

The **Billing** overview lists shops with overdue ones first, plus monthly recurring revenue, unpaid totals and how many shops need attention.
