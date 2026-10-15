import { getUser } from "@/lib/session";
import { withShop } from "@/lib/tenant";

export async function GET(req: Request, ctx: RouteContext<"/api/products/[id]/image">) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!user.shopId) return new Response("Not found", { status: 404 });
  const { id } = await ctx.params;
  // Only this shop's products are visible inside withShop, so another shop's image id is simply "not found".
  const p = await withShop(user.shopId, (db) => db.product.findUnique({ where: { id }, select: { imageData: true, imageType: true } }));
  if (!p?.imageData || !p.imageType) return new Response("Not found", { status: 404 });
  // The address carries a version that changes with the photo, so a versioned request can be kept for a year. An
  // unversioned one (an old bookmark or cached page) must be re-checked every time so it can never show a stale photo.
  const versioned = new URL(req.url).searchParams.has("v");
  return new Response(new Uint8Array(p.imageData), {
    headers: { "Content-Type": p.imageType, "Cache-Control": versioned ? "private, max-age=31536000, immutable" : "private, no-cache", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" },
  });
}
