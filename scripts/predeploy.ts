// Runs before `next build` (locally and on Vercel):
//   1. generate the Prisma client
//   2. apply pending database migrations
//   3. set up the starting data, depending on the environment:
//        - DEMO_DATA=1      -> load the demo shops, but only into an EMPTY database (for development / staging)
//        - otherwise        -> create the platform-owner account from PLATFORM_OWNER_EMAIL / PLATFORM_OWNER_PASSWORD
//                              if no platform owner exists yet (for production)
// There is deliberately no switch that wipes a database: this must be safe to run on every deploy of a live system.
// With no database URL (e.g. a preview build with no database attached) only the client is generated.
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
  if (process.env.DEMO_DATA === "1") {
    console.log("[predeploy] DEMO_DATA=1: loading demo shops if the database is empty...");
    run("npx tsx prisma/seed.ts", { SEED_IF_EMPTY: "1" });
  } else {
    run("npx tsx scripts/bootstrap-owner.ts");
  }
}
