import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { getUser } from "@/lib/session";

export default async function Home() {
  const user = await getUser();
  if (!user) redirect("/login");
  redirect(can(user.role, "dashboard.view") ? "/dashboard" : "/pos");
}
