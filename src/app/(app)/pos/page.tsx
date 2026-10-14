import type { Metadata } from "next";
import { buildCatalog } from "@/lib/pos-catalog";
import { pageGuard } from "@/lib/guard";
import { PosTerminal } from "./terminal";

export const metadata: Metadata = { title: "Point of Sale" };

export default async function PosPage() {
  const user = await pageGuard("pos.sell");
  return <PosTerminal initial={await buildCatalog(user)} />;
}
