import type { Prisma } from "@/generated/prisma/client";
import { rawDb } from "@/lib/db";

/** A database client bound to one transaction (and therefore to one shop). */
export type Tx = Prisma.TransactionClient;

const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

/**
 * Runs `fn` inside ONE transaction that can only see and change the given shop's data.
 *
 * It switches to the restricted `duuka_app` role (which cannot bypass row-level security) and records the shop in
 * `app.shop_id`; the database policies do the rest. A query that forgets a `where shopId` still returns only this
 * shop's rows, and an insert is stamped with this shop automatically.
 *
 * Because it is a transaction, throwing inside `fn` rolls everything back. Don't open another `$transaction` inside it.
 */
export function withShop<T>(shopId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!shopId) throw new Error("withShop requires a shop id");
  return rawDb.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE duuka_app`;
    await tx.$queryRaw`SELECT set_config('app.shop_id', ${shopId}, true)`;
    return fn(tx);
  }, TX_OPTIONS);
}

/**
 * Platform-level access across all shops. Only for the platform owner's own screens, and for the few steps that
 * must happen before a shop is known (finding a user by email at sign-in). Use sparingly.
 */
export function asPlatform<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return rawDb.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE duuka_app`;
    await tx.$queryRaw`SELECT set_config('app.platform', 'on', true)`;
    return fn(tx);
  }, TX_OPTIONS);
}
