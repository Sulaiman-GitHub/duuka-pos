import "server-only";
import { notFound, redirect } from "next/navigation";
import { can, type ShopPermission } from "@/lib/permissions";
import { getUser, type SessionUser, type ShopUser } from "@/lib/session";

// For pages inside a shop: redirect when signed out, and to "access denied" when the role lacks the permission
// (the platform owner has no shop permissions, so shop pages are closed to them).
export async function pageGuard(perm: ShopPermission): Promise<ShopUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!user.shopId || !user.shopName || !can(user.role, perm)) redirect("/forbidden");
  return user as ShopUser;
}

// For the platform owner's pages.
export async function platformGuard(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!can(user.role, "platform.manage")) redirect("/forbidden");
  return user;
}

export { notFound };
