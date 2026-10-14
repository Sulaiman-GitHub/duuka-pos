import { asPlatform, withShop, type Tx } from "@/lib/tenant";

/**
 * Writes an activity-log entry inside the caller's transaction (so it commits or rolls back with the change it
 * describes). `shopId` is the shop the entry belongs to; null for platform-level events.
 */
export async function audit(tx: Tx, shopId: string | null, userId: string | null, action: string, entity?: string, entityId?: string, detail?: string) {
  await tx.auditLog.create({ data: { shopId, userId, action, entity, entityId, detail } });
}

/** Logs an event in its own short transaction, for actions that have no transaction of their own to join. */
export async function auditNow(shopId: string, userId: string | null, action: string, entity?: string, entityId?: string, detail?: string) {
  await withShop(shopId, (tx) => audit(tx, shopId, userId, action, entity, entityId, detail));
}

/** Logs a platform-level event (not tied to a shop, or logged before the shop is known). */
export async function auditPlatform(shopId: string | null, userId: string | null, action: string, entity?: string, entityId?: string, detail?: string) {
  await asPlatform((tx) => audit(tx, shopId, userId, action, entity, entityId, detail));
}
