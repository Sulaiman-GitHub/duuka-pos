import { z } from "zod";
import { can } from "@/lib/permissions";
import { sellInShop, syncSaleSchema, type SaleResult } from "@/lib/sales";
import { getUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { withShop } from "@/lib/tenant";

const bodySchema = z.object({ sales: z.array(z.unknown()).min(1).max(25) });

/**
 * Receives sales from a till, one at a time and each in its own transaction, so one bad sale never blocks the rest.
 * Safe to call repeatedly: a sale's `clientId` makes the upload idempotent.
 */
export async function POST(req: Request) {
  // This endpoint is called with the session cookie, so refuse requests that didn't come from our own pages.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== (req.headers.get("x-forwarded-host") ?? req.headers.get("host"))) return Response.json({ error: "Bad origin" }, { status: 403 });

  const user = await getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!user.shopId || !can(user.role, "pos.sell")) return Response.json({ error: "Forbidden" }, { status: 403 });
  const shopId = user.shopId;

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const rules = await getSettings(shopId);
  const now = new Date();

  const results: ({ clientId: string } & SaleResult)[] = [];
  for (const raw of body.data.sales) {
    const parsed = syncSaleSchema.safeParse(raw);
    if (!parsed.success) {
      const cid = typeof (raw as { clientId?: unknown })?.clientId === "string" ? (raw as { clientId: string }).clientId : "";
      results.push({ clientId: cid, error: parsed.error.issues[0]?.message ?? "Invalid sale." });
      continue;
    }
    const s = parsed.data;
    // The sale belongs to whoever rang it up, but only a manager/admin may upload on someone else's behalf.
    let actor = { id: user.id, role: user.role };
    if (s.cashierId && s.cashierId !== user.id && can(user.role, "sales.viewAll")) {
      const c = await withShop(shopId, (tx) => tx.user.findUnique({ where: { id: s.cashierId }, select: { id: true, role: true } }));
      if (c) actor = c;
    }
    const offline = s.mode === "offline";
    const r = await sellInShop(shopId, actor, s, rules, now, {
      clientId: s.clientId,
      offline: offline ? { at: s.offlineAt ? new Date(s.offlineAt) : now, catalogAt: s.catalogAt ? new Date(s.catalogAt) : null, prices: s.prices ?? {}, expectedTotal: s.expectedTotal } : undefined,
    });
    results.push({ clientId: s.clientId, ...r });
  }
  return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
