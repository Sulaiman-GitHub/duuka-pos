// Creates the first platform-owner account on a fresh production database, from environment variables.
// Does nothing if a platform owner already exists, so it is safe on every deploy. Never prints the password.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { databaseUrl } from "../src/lib/db-url";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });

async function main() {
  const email = process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.PLATFORM_OWNER_PASSWORD;
  const name = process.env.PLATFORM_OWNER_NAME?.trim() || "Platform Owner";

  const created = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.platform', 'on', true)`;
    if (await tx.user.count({ where: { role: "PLATFORM_OWNER" } })) return "exists";
    if (!email || !password) return "missing";
    if (password.length < 12) return "weak";
    await tx.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 10), role: "PLATFORM_OWNER" } });
    return "created";
  });

  const messages = {
    exists: "[bootstrap] A platform owner already exists - nothing to do.",
    created: `[bootstrap] Platform owner created (${email}).`,
    missing: "[bootstrap] No platform owner yet. Set PLATFORM_OWNER_EMAIL and PLATFORM_OWNER_PASSWORD, then redeploy.",
    weak: "[bootstrap] PLATFORM_OWNER_PASSWORD must be at least 12 characters. No account was created.",
  } as const;
  console.log(messages[created]);
}

main().finally(() => db.$disconnect());
