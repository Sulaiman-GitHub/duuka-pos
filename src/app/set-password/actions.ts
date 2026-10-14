"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auditPlatform } from "@/lib/audit";
import { consumeToken } from "@/lib/tokens";

export type SetPasswordState = { error?: string };

const schema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password is too long"),
  confirm: z.string(),
});

export async function setPassword(_p: SetPasswordState, fd: FormData): Promise<SetPasswordState> {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.password !== parsed.data.confirm) return { error: "The two passwords don't match." };
  const user = await consumeToken(parsed.data.token, await bcrypt.hash(parsed.data.password, 10));
  if (!user) return { error: "This link is invalid or has expired. Ask for a new one." };
  await auditPlatform(user.shopId, user.id, "user.password_set", "User", user.id, "via link");
  redirect("/login?done=1");
}
