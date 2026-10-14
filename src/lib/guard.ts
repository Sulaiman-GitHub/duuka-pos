import "server-only";
import { notFound, redirect } from "next/navigation";
import { can, type Permission } from "@/lib/permissions";
import { getUser } from "@/lib/session";

// For pages: redirect when signed out, 404-style forbidden message when role lacks the permission.
export async function pageGuard(perm: Permission) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!can(user.role, perm)) redirect("/forbidden");
  return user;
}

export { notFound };
