import { db } from "@/lib/db";
import { getUser } from "@/lib/session";

export async function GET(_req: Request, ctx: RouteContext<"/api/products/[id]/image">) {
  if (!(await getUser())) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const p = await db.product.findUnique({ where: { id }, select: { imageData: true, imageType: true } });
  if (!p?.imageData || !p.imageType) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(p.imageData), {
    headers: { "Content-Type": p.imageType, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" },
  });
}
