# Technical documentation

## Overview

Duuka POS is a single **Next.js 16** application (App Router) backed by **PostgreSQL** through **Prisma**. Pages are
React Server Components that read data directly on the server; changes go through **Server Actions**; a few
**route handlers** serve files (product images, CSV exports, a health check). There is no separate API service.

```
Browser ──► proxy.ts (cookie present?) ──► page / server action / route handler
                                              │  pageGuard / requirePermission  (session → user → role → permission)
                                              ▼
                                      domain logic in src/lib  (sales, returns, inventory, analytics, reports)
                                              ▼
                                   Prisma (pg adapter) ──► PostgreSQL (Neon)
```

## Project layout

```
prisma/             schema.prisma, migrations/, seed.ts (demo data)
scripts/predeploy.ts  runs before `next build`: generate client → migrate → seed-if-empty
src/proxy.ts        first-line redirect to /login when there is no session cookie
src/app/
  login/            sign-in page and actions
  (app)/            everything behind sign-in: dashboard, pos, sales, products, inventory,
                    suppliers (+orders), reports, users, settings, audit
  api/              health, products/[id]/image, reports/csv
src/components/     ui primitives, hand-built SVG charts, sidebar
src/lib/            db, session, permissions, guard, inventory, sales, returns, analytics, reports,
                    settings, audit, money, time        ← business logic lives here, not in components
tests/              unit/ (pure logic) and integration/ (real PostgreSQL)
docs/               this documentation, schema.sql, screenshots
```

Business rules are deliberately kept in `src/lib` as plain functions that receive the database client as an argument
(`createSale`, `createReturn`, `applyStockChange`). Server actions are thin wrappers that authenticate, validate and
audit — which is what makes the rules directly testable.

## Roles and permissions

One map in `src/lib/permissions.ts` is used by the sidebar, page guards, server actions and API routes.

| Permission | Admin | Manager | Cashier |
|---|:--:|:--:|:--:|
| Sell at the POS (`pos.sell`) | ✅ | ✅ | ✅ |
| View own sales / receipts (`sales.view`) | ✅ | ✅ | ✅ |
| View everyone's sales (`sales.viewAll`) | ✅ | ✅ | |
| Refund / return (`sales.refund`) | ✅ | ✅ | |
| Manage products & categories (`products.manage`) | ✅ | ✅ | |
| View inventory (`inventory.view`) | ✅ | ✅ | ✅ |
| Adjust stock (`inventory.adjust`) | ✅ | ✅ | |
| Reports & dashboard (`reports.view`, `dashboard.view`) | ✅ | ✅ | |
| Suppliers & purchase orders (`suppliers.manage`) | ✅ | ✅ | |
| Users, settings, activity log | ✅ | | |

Checks happen in three layers, so hiding a menu item is never the only protection:
1. `proxy.ts` redirects requests with no session cookie (a cheap, optimistic check only).
2. Every page calls `pageGuard(permission)`; every server action and route handler calls `requirePermission(...)`.
3. Row-level rules inside the logic: e.g. a cashier asking for someone else's receipt gets "not found".

## Authentication and sessions

- Passwords are hashed with **bcrypt** (cost 10). Unknown emails are compared against a dummy hash so response time
  doesn't reveal which accounts exist.
- A successful login sets a signed **JWT** (HS256, 12 h) in an `httpOnly`, `SameSite=Lax`, `Secure` (in production) cookie.
- The user is **re-read from the database on every request**, so deactivating an account or changing a role takes effect
  immediately — an open session is cut off at its next click.
- **Login throttling** is stored in the database (not process memory) so it holds across serverless instances: 8 failures
  per email+IP or 30 per IP in 10 minutes. Keying on the IP means a stranger can't lock a real user out of their own account.
- Users can't remove their own admin access, and the system always keeps at least one active admin.

## Security measures

| Area | Measure |
|---|---|
| Injection | All SQL is parameterised (Prisma queries and tagged-template raw SQL); no string-built queries |
| Input | Every action validates with **Zod** on the server; the browser is never trusted for prices, totals or permissions |
| XSS | React escapes output; strict **Content-Security-Policy**; no third-party scripts |
| Clickjacking / sniffing / transport | `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, HSTS, strict referrer policy |
| CSRF | Server Actions enforce same-origin; session cookie is `SameSite=Lax`; no state-changing GET endpoints |
| Uploads | Image type is decided by the file's **signature bytes**, not the browser-declared type; served with `nosniff` and a sandbox CSP |
| Export | CSV cells starting with `= + - @` are neutralised (spreadsheet formula injection) |
| Access control | Permission checks on every page, action and route; object-level checks on receipts |
| Auditing | Sign-ins, failed sign-ins and every change are written to an admin-visible activity log |
| Secrets | Only in environment variables; `.env` is git-ignored; the app refuses to start sessions without a 32+ character `SESSION_SECRET` |

## Money rules

All amounts are **whole Uganda Shillings stored as integers** — no floating-point rounding errors.

- **Prices come from the database.** The browser sends only product ids and quantities; `createSale` recomputes the
  subtotal, discount and total. A tampered request cannot change what is charged.
- **Price snapshots.** A sale line stores the unit price *and unit cost* at the time of sale, so later price changes never
  alter old receipts or historical profit.
- **Net sales** = sale total − refunds issued against it.
  **Gross profit** = net sales − cost of the items that were *not* returned. (Returned items are assumed to go back to stock.)
- **Refunds respect discounts.** A sale-level discount is shared proportionally across items, so returning one item
  refunds what was actually paid for it. When a return completes the sale, any rounding difference is settled so the
  refunds add up to *exactly* the amount paid.
- **Discount limits.** Cashiers may discount up to a configurable percentage (Settings, default 10%); the limit is
  enforced on the server.

## Inventory: the stock ledger

`products.stock` is the current balance, and **every change** also writes a row to `StockMovement` (type, signed
quantity, balance after, reason, reference, user). All changes go through one function, `applyStockChange`, inside a
database transaction:

```sql
UPDATE "Product" SET stock = stock + :delta WHERE id = :id AND stock >= :needed   -- atomic; fails if it would go negative
```

Movement types: opening stock, sale, customer return, purchase received, adjustment (+/−), damaged/expired.

## Concurrency

Tills can finish sales at the same instant, so correctness is enforced by the database, not by hoping requests arrive
politely:

| Risk | Protection |
|---|---|
| Two sales of the last unit | Conditional `UPDATE … WHERE stock >= n`; exactly one succeeds (tested: 12 simultaneous sales of 5 units → 5 succeed) |
| Duplicate receipt numbers | An atomic per-day counter (`ReceiptCounter` upsert) allocates `RCP-YYYYMMDD-NNNN`; numbering continues after any existing receipts |
| Two refunds of the same items | The sale row is locked (`SELECT … FOR UPDATE`) for the whole return |
| Double receiving of a purchase order | The order row is locked while stock is received |
| Half-finished sales | The sale, its lines, the stock changes and ledger rows are **one transaction** — it all happens or none of it does |

## Costs are hidden from cashiers

Buying costs, stock value at cost and profit need the `costs.view` permission (managers and admins). For cashiers the Products and Inventory pages leave the cost column and the "Value at cost" figures out, and the cost values are removed on the server before the page is built, so they are not in the page data either. The till's offline product list never contains costs, and receipts show selling prices only. Dashboard and Reports (where profit appears) were already closed to cashiers.

## Multi-shop tenancy

Every business table carries a `shopId`. Isolation is enforced in PostgreSQL itself with **row-level security**
(`ENABLE` + `FORCE`): each request runs in one transaction that executes `SET LOCAL ROLE duuka_app` (no `BYPASSRLS`) and
sets `app.shop_id`; policies allow only rows of that shop. `withShop(shopId, fn)` (`src/lib/tenant.ts`) is the only way
request code reaches the database, and `asPlatform` (platform-owner screens, login and session lookups) is the only
cross-shop path. Rules: one email belongs to exactly one shop (globally unique); only the platform owner creates shops and
their first administrator; shop administrators manage their own staff; suspended shops cannot sign in.
`tests/integration/tenant-isolation.test.ts` attacks these boundaries (reads, writes, forged `shopId`, missing context).

## Offline-first till

The point-of-sale screen keeps working with no internet, on phones and PCs (it is an installable web app, so no app store is needed).

- **What is stored on the device:** the shop's products, prices, categories and receipt details (IndexedDB), and a queue of sales waiting to upload. A service worker (`public/sw.js`) keeps the till page and its scripts so it opens offline; it never caches `/api` data.
- **Selling offline:** a sale is saved to the queue with a unique `clientId` and a provisional receipt is shown/printed from local data. When the connection returns (checked by a heartbeat, and by the browser's online event) the queue uploads automatically to `POST /api/sync/sales`, oldest first, each sale in its own transaction.
- **Safe to repeat:** `(shopId, clientId)` is unique, so a retry, a lost response, or two tabs uploading at once records the sale once. Even a "live" sale whose reply was lost is later reported as a duplicate, not recorded twice.
- **Online sales** use the same endpoint in `live` mode with the original strict rules (live price, no overselling, discount limit).
- **Offline sales are always accepted** because the goods already left the shop. Anything the server would have refused is recorded and **flagged for review** (`Sale.needsReview` + `reviewNote`, shown to managers with a "Mark as reviewed" button): stock gone negative, a discount above the cashier limit, an item deactivated meanwhile, or a total that differs from what the till charged. The price the till showed is honoured only if the product could really have changed after the till last synced; otherwise the database price is used and the sale is flagged.
- **Receipt numbers:** offline sales get a provisional `OFF-…` reference; the real, sequential receipt number is assigned when the sale uploads.
- **Identity:** the sale is credited to the cashier who rang it up. On a shared device a cashier's till uploads only that cashier's waiting sales (the server also refuses to credit one person's sale to another); a manager or admin can upload everyone's, and the server records the real cashier. Queued sales stay on the device until they reach the server (signing out does not delete them), and an expired sign-in only pauses the upload.
- **Saving the till for offline use:** every signed-in user who can sell triggers, from whichever screen they land on, a save of the till page and all of its scripts and styles (at most every 12 hours, and again after each sign-in). Without this, someone who lands on the dashboard and never opens the till online would find it missing offline. If it is still missing, the device says so plainly instead of looping.
- **Scope:** selling is fully offline-capable. Dashboard, sales/receipts, products, inventory and reports open offline from the last copy viewed (with an "offline, may be out of date" banner). Users, settings, audit and platform pages are never saved and need a connection; nothing can be changed offline except selling. Saved page copies are cleared when the sign-in page is shown.
- **Printing:** receipts are plain data (`ReceiptData`) rendered by one component laid out for 58/80 mm rolls, or turned into ESC/POS bytes (`src/lib/printing/escpos.ts`) for direct USB/Bluetooth printing; see [PRINTERS.md](PRINTERS.md).

## Billing

Subscriptions are invoiced manually by the platform owner (see [BILLING.md](BILLING.md)). A shop has a plan (`planName`, `monthlyPrice`, `maxUsers`) and is *covered* until `paidUntil` (or `trialEndsAt` while on trial); `billingStatus()` turns that into Trial / Paid / Due soon / Overdue. `createInvoice` bills the next unbilled period (after paid cover, a running trial and earlier unpaid invoices), numbers invoices from an atomic counter, and `markInvoicePaid` is a conditional update so a double click or two people at once records one payment and extends cover to the end of the invoice period (never shortening it). Invoices can be **read** by their own shop but **written only at platform level** (separate row-level-security policies); platform settings are platform-only. Overdue shops are flagged, never locked out automatically.

## Time zones

The shop operates in Uganda (UTC+3, no daylight saving) but servers run in UTC. Day boundaries for "today", reports,
receipt numbers and charts are computed explicitly in `Africa/Kampala` (`src/lib/time.ts`, and
`AT TIME ZONE` in SQL), and are covered by tests (e.g. 21:00 UTC is already tomorrow in Kampala).

## Reporting

`saleFacts()` in `src/lib/analytics.ts` is the single source for sales figures. It returns one row per sale with its
refunds and net cost of goods, and the dashboard, every report and the CSV export all derive from it — so the numbers
always agree. This was verified against an independent SQL query (231 transactions, UGX 7,976,750 net over the same
30 days on the demo data).

## Charts

The three charts are small hand-written SVG/HTML components (`src/components/charts.tsx`), not a charting library:
2 px lines, thin bars with rounded ends, hover and keyboard tooltips, direct labels, and a **table view** for each chart
so no information depends on seeing colour or using a mouse.

## Build and deploy pipeline

`npm run build` runs `scripts/predeploy.ts` first: generate the Prisma client → `prisma migrate deploy` → load demo data
**only if the database is empty**. Pushing to the production branch on Vercel therefore migrates the database and builds
the app in one step. The first platform owner is created from
`PLATFORM_OWNER_*` variables if none exists; demo shops load only with `DEMO_DATA=1` into an empty database. There is no
wipe switch in production (see [DEPLOYMENT.md](DEPLOYMENT.md)).

Product images live in PostgreSQL (`bytea`) and are served by `/api/products/[id]/image`, because serverless hosting has
no persistent disk.

## Testing

`npm test` runs **128 tests** (Vitest).

| Suite | Covers |
|---|---|
| `tests/unit` | Permission matrix, Kampala day boundaries, money formatting, period bucketing and zero-filling, net/profit definitions, CSV escaping and formula-injection protection, report parameter handling |
| `tests/integration` | Against a real PostgreSQL database (`duuka_test`, created and migrated automatically; skipped if Postgres isn't reachable): stock ledger rules and concurrency, selling (pricing, discounts, caps, rollback, receipt numbering, simultaneous sales), returns (proportional refunds, exact settlement, double-refund protection, concurrent refunds) and the reporting SQL |

Test runs refuse to start against any database whose name doesn't contain `test`. In addition, the application was
exercised end-to-end in a real browser (sign-in, every role's access, sales, refunds, purchase orders, reports, CSV, the
login lockout, phone layouts) during development.

## Design decisions

- **One Next.js app, no separate API.** Fewer moving parts to deploy and secure; Server Actions keep forms simple.
- **Integers for money, a ledger for stock.** Auditability and correctness matter more than convenience.
- **Domain logic outside actions.** Testable without HTTP, sessions or mocks.
- **Database-enforced concurrency.** Locks and conditional updates instead of application-level checks.
- **Re-reading the user each request.** A small query buys instant revocation, which a stateless token alone can't give.

## Known limitations

- **Demo credentials are public** by design; never load demo data in production. MFA is not implemented yet.
- **Tenant isolation hardening:** the app connects as the database owner and drops to the restricted `duuka_app` role per
  request (`SET LOCAL ROLE`). Application code never runs arbitrary SQL (ESLint bans `*RawUnsafe`), but before onboarding
  real customers the runtime should connect with a separate non-owner login role so that switching back is impossible.
- **Foreign keys do not enforce same-shop references**; the application checks them (e.g. a product's category must belong to the shop).
- **Dependency advisories:** `npm audit` reports 4 findings (`prisma` CLI → `mysql2`, `deepmerge-ts`). They are in Prisma's
  command-line tooling, which runs only at build time; the running application uses the PostgreSQL driver and never loads
  `mysql2`. No patched 7.x release exists at the time of writing; the 8.x line is a release candidate with a different CLI.
- **Parked sales** are stored per browser (`localStorage`), not on the server.
- **PDF export** relies on the browser's *Save as PDF*; there is no server-side PDF generator.
- **Currency** is stored per shop; the platform owner picks it per shop (UGX, KES, TZS, RWF) and it is locked once the shop has recorded sales, because amounts are stored as whole units without a currency tag.
- **Sessions** are stateless JWTs: a stolen cookie works until it expires (12 h) or the user is deactivated.
