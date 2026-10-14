import { can } from "@/lib/permissions";
import { buildCatalog } from "@/lib/pos-catalog";
import { getUser } from "@/lib/session";

/** The till's copy of the shop's products, prices and settings. Cached on the device (IndexedDB) for offline selling. */
export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!user.shopId || !user.shopName || !can(user.role, "pos.sell")) return Response.json({ error: "Forbidden" }, { status: 403 });
  return Response.json(await buildCatalog(user as typeof user & { shopId: string; shopName: string }), { headers: { "Cache-Control": "no-store" } });
}
