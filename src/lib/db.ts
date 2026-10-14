import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { databaseUrl } from "@/lib/db-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create() {
  const adapter = new PrismaPg({ connectionString: databaseUrl() });
  return new PrismaClient({ adapter });
}

/**
 * The raw database client. It connects as the owner role and is NOT scoped to a shop, so application code must not
 * use it directly: go through `withShop` / `asPlatform` in `@/lib/tenant`, which switch to the restricted role and
 * set the shop context. ESLint enforces this (see eslint.config.mjs).
 */
export const rawDb = globalForPrisma.prisma ?? create();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = rawDb;
