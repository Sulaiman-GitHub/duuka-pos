# Duuka POS

Point-of-sale, inventory and reporting software for retail shops — being grown from a complete single-shop system into a
**multi-shop online platform**, where each shop owner signs up, adds their own staff and chooses the categories they sell.

> **Status:** the single-shop baseline below is complete and tested. Multi-shop support is the next milestone
> (see the [roadmap](#roadmap)); until it lands, one deployment serves one shop.

## What it does today

- **Roles** — administrator, manager and cashier, with permissions enforced on the server.
- **Products & categories** — SKUs, barcodes, buying cost and selling price, stock and minimum level, images.
- **Inventory** — automatic stock deduction, adjustments, a complete stock ledger, low/out-of-stock alerts, valuation.
- **Point of sale** — fast search and barcode entry, discounts (with a cashier limit), cash / Mobile Money / card /
  bank transfer, printable receipts, parked sales, keyboard shortcuts, phone and tablet friendly.
- **Sales** — search and filters, receipts, returns and refunds that respect discounts and restock.
- **Dashboard & reports** — today's figures, trends, best sellers, seven reports with date filters, CSV export, print/PDF.
- **Suppliers & purchase orders** — ordering, partial deliveries, receiving stock.
- **Administration** — users, shop settings, activity log.

## Technology

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL · Prisma 7 · Zod · Vitest.
Hosted on Vercel with a Neon PostgreSQL database. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Demo accounts

After seeding (`npm run db:seed`) these accounts exist — demo data only, change or remove them before real use:

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@pos.test` | `Admin@123` |
| Manager | `manager@pos.test` | `Manager@123` |
| Cashier | `cashier@pos.test` | `Cashier@123` |

## Run it locally

Requirements: **Node.js 22+** and **PostgreSQL 14+**.

```bash
git clone https://github.com/Sulaiman-GitHub/duuka-pos.git && cd duuka-pos
npm install

createdb pos
cp .env.example .env                 # then edit DATABASE_URL and SESSION_SECRET
npx prisma migrate deploy
npm run db:seed                      # demo data (WIPES the database)

npm run dev                          # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build (also migrates, and seeds an empty database) / run it |
| `npm test` | 55 automated tests (a separate `pos_test` database is created automatically) |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |

Deployment guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Database: [docs/DATABASE.md](docs/DATABASE.md).

## Roadmap

| Phase | Goal | Contents |
|---|---|---|
| **1 · Multi-shop core** | Many shops, fully isolated | `Shop` (tenant) model and `shopId` on every table; per-shop uniqueness; shop-scoped data access plus PostgreSQL row-level security; cross-shop isolation tests; shop sign-up; owners invite their own managers and cashiers; category templates ("what do you sell?") |
| **2 · Owner experience** | Self-service | Password reset and invitations by email, per-shop settings and currency, platform admin console |
| **3 · Commercial** | Run it as a business | Plans and billing (local payment providers), usage limits, terms and privacy policy, monitoring and backups |
| **4 · Field-ready** | Fit real shops | Offline mode with sync, receipt-printer support, automatic Mobile Money confirmation, tax-receipt integration |

## Known limitations of the baseline

- One shop per deployment and one currency (UGX); no offline mode.
- Mobile Money is recorded with a reference, not confirmed automatically.
- Product images are stored in the database (fine for a small catalogue; use object storage at scale).
- `npm audit` reports advisories inside Prisma's build-time command-line tooling; see
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#known-limitations).
