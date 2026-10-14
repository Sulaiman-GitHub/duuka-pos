// Gives the demo products their illustrations - ONLY products that have no image yet, so a photo someone uploaded
// through the Edit Product page is never overwritten. Safe to run on every deploy.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { databaseUrl } from "../src/lib/db-url";
import { imageNames, productImage } from "../prisma/images";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });

async function main() {
  let added = 0;
  for (const name of imageNames()) {
    const img = productImage(name);
    if (!("imageData" in img)) continue;
    const r = await db.product.updateMany({ where: { name, imageData: null }, data: img });
    added += r.count;
  }
  console.log(`[images] Added illustrations to ${added} product(s) that had no image.`);
}

main().finally(() => db.$disconnect());
