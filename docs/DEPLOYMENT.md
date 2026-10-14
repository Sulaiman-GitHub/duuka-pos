# Setup and deployment

## What you need

- A GitHub repository with this code
- A **Vercel** account (the free Hobby plan is enough)
- A **Neon** PostgreSQL database (free plan) — easiest to add from inside Vercel

## Deploy on Vercel + Neon

1. **Import the project.** In Vercel choose *Add New → Project*, pick the repository, keep the detected *Next.js*
   settings and deploy once (it can fail or have no database at this point — that's fine).
2. **Add a database.** Project → **Storage → Create Database → Neon**. Pick the free plan and a region close to your
   Vercel functions (default `iad1`, Washington D.C.). Connect it to the project for **Production** and **Preview**,
   leave the *Custom Prefix* empty, and **untick** "Create database branch for deployment" so there is one single
   database. Vercel adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for you.
3. **Add the session secret.** Project → **Settings → Environment Variables → Add**:
   `SESSION_SECRET` = a random string of 32+ characters (`openssl rand -base64 48`). Apply to all environments.
4. **Redeploy** (Deployments → latest → ⋯ → Redeploy, build cache off). The build log shows:

   ```
   [predeploy] Applying migrations...
   [predeploy] Seeding demo data if the database is empty...
   Seeded 4 users, 44 products, … sales.
   ```

5. **Open the URL** and sign in with a [demo account](../README.md#demo-accounts).

From then on, every push to the production branch migrates the database and redeploys automatically. Demo data is only
loaded into an *empty* database, so real data is never overwritten. Each deploy also gives demo products that have
**no image** their illustration; products that already have an image (for example one you uploaded) are left alone.

### Optional environment variables

| Variable | Purpose |
|---|---|
| `BUSINESS_NAME`, `BUSINESS_ADDRESS`, `BUSINESS_PHONE`, `RECEIPT_FOOTER` | Defaults for receipts until an administrator saves **Settings** |
| `DATABASE_URL_UNPOOLED` | Direct connection used for migrations (set automatically by the Neon integration) |
| `RESET_DEMO_DATA` | See below |

### Resetting to clean demo data

To remove test sales and reload the demo data for a presentation:

1. Add the environment variable `RESET_DEMO_DATA` with the exact value `YES-DELETE-EVERYTHING`.
2. Redeploy. The build log will show a warning and the database is wiped and re-seeded.
3. **Immediately delete the variable** — while it is set, *every* deploy wipes the data.

> The reset also deletes any product photos that were uploaded through the app, and reloads the demo illustrations. Skip it
> if you want to keep them.

### Production checklist

- Replace the demo passwords (Users page), or remove the demo accounts, before storing real data.
- Make sure the production domain is public (Project → Settings → Deployment Protection) if outsiders must reach it.
- Back up the database (Neon has point-in-time restore on paid plans; export with `pg_dump` otherwise).

## Run locally

Requirements: Node.js 22+, PostgreSQL 14+.

```bash
npm install
createdb pos
cp .env.example .env            # edit DATABASE_URL and SESSION_SECRET
npx prisma migrate deploy
npm run db:seed
npm run dev                     # http://localhost:3000
```

Run the tests with `npm test`; they use a separate database named `pos_test` on the same server (created automatically).

## Other hosts

Any host that runs Node.js 22 and PostgreSQL works: set `DATABASE_URL` and `SESSION_SECRET`, run `npm run build`, then
`npm start`. `npm run build` migrates the database and seeds it if empty.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Sign-in fails with an error page | `SESSION_SECRET` missing/too short, or no `DATABASE_URL` — check the environment variables, then redeploy |
| New pages show "not found" | You're on an old deployment's address (`…-abc123.vercel.app`). Use the project's main domain |
| Build fails at `prisma migrate deploy` | Database unreachable or credentials wrong — read the build log |
| "Too many failed attempts" at sign-in | Login lockout; wait 10 minutes |
