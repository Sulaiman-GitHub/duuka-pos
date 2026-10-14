import "server-only";
import { cache } from "react";
import { getUser } from "@/lib/session";
import { toSettings, type Settings } from "@/lib/settings-shape";
import { withShop } from "@/lib/tenant";

export type { Settings };

/**
 * A shop's settings (name, contact details, receipt footer, discount limit, currency, paper width). The signed-in user's
 * lookup already loaded their own shop's row, so that is reused and no extra database round trips are made; another
 * shop's settings (only needed by the platform owner) are read directly.
 */
export const getSettings = cache(async (shopId: string): Promise<Settings> => {
  const me = await getUser();
  if (me?.shopId === shopId && me.settings) return me.settings;
  const s = await withShop(shopId, (tx) => tx.shop.findUniqueOrThrow({ where: { id: shopId } }));
  return toSettings(s);
});
