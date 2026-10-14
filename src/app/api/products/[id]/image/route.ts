import { getUser } from "@/lib/session";
import { withShop } from "@/lib/tenant";

export async function GET(_req: Request, ctx: RouteContext<"/api/products/[id]/image">) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!user.shopId) return new Response("Not found", { status: 404 });
  const { id } = await ctx.params;
  // Only this shop's products are visible inside withShop, so another shop's image id is simply "not found".
  const p = await withShop(user.shopId, (db) => db.product.findUnique({ where: { id }, select: { imageData: true, imageType: true } }));
  if (!p?.imageData || !p.imageType) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(p.imageData), {
    headers: { "Content-Type": p.imageType, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" },
  });
}
