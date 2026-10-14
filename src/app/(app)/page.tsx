import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { getUser } from "@/lib/session";

export default async function Home() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role === "PLATFORM_OWNER") redirect("/platform");
  redirect(can(user.role, "dashboard.view") ? "/dashboard" : "/pos");
}
