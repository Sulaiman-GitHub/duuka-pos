import { execSync } from "node:child_process";
import pg from "pg";

const DEFAULT = "postgresql://pos:pos@localhost:5432/pos_test";

/** Creates the test database if needed and applies migrations. Silently skips when Postgres isn't reachable. */
export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? DEFAULT);
  const dbName = url.pathname.slice(1);
  if (!/test/i.test(dbName)) throw new Error(`Refusing to run tests against "${dbName}": the database name must contain "test".`);

  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  try {
    await client.connect();
    const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (!exists.rowCount) await client.query(`CREATE DATABASE "${dbName}"`);
    await client.end();
  } catch {
    console.warn("\n[tests] PostgreSQL is not reachable - database tests will be skipped.\n");
    return;
  }
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url.toString(), DATABASE_URL_UNPOOLED: url.toString() } });
}
