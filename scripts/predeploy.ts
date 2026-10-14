// Runs before `next build` (locally and on Vercel):
//   1. generate the Prisma client
//   2. apply pending migrations
//   3. load demo data, but only into an EMPTY database (never overwrites real data),
//      unless RESET_DEMO_DATA=YES-DELETE-EVERYTHING is set for a deliberate one-off reset
//   4. give demo products their illustrations (only those without an image)
// With no DATABASE_URL (e.g. a preview build with no database attached) it just generates the client and skips the rest.
import "dotenv/config";
import { execSync } from "node:child_process";
import { databaseUrl } from "../src/lib/db-url";

const run = (cmd: string, env: Record<string, string> = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });

run("npx prisma generate");

if (!databaseUrl()) {
  console.log("[predeploy] No database URL is set - skipping migrations and seed.");
} else {
  console.log("[predeploy] Applying migrations...");
  run("npx prisma migrate deploy");
  if (process.env.RESET_DEMO_DATA === "YES-DELETE-EVERYTHING") {
    console.warn("[predeploy] RESET_DEMO_DATA is set: wiping the database and reloading demo data. Remove this variable after this deploy.");
    run("npx tsx prisma/seed.ts");
  } else {
    console.log("[predeploy] Seeding demo data if the database is empty...");
    run("npx tsx prisma/seed.ts", { SEED_IF_EMPTY: "1" });
  }
  run("npx tsx scripts/attach-product-images.ts"); // fills in only products that have no image
}
