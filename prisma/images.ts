import fs from "node:fs";
import path from "node:path";

// Original product illustrations (see tools/product-images). Paths are relative to the project root, which is the
// working directory for `npm run build`, `npm run db:seed` and Vercel builds.
const dir = path.join(process.cwd(), "prisma", "product-images");

let manifest: Record<string, string> | null = null;
const load = () => (manifest ??= JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")) as Record<string, string>);

export const imageNames = () => Object.keys(load());

/** Image columns for a demo product, or an empty object when we have no illustration for that name. */
export function productImage(name: string): { imageData: Uint8Array<ArrayBuffer>; imageType: string } | Record<string, never> {
  const file = load()[name];
  if (!file) return {};
  return { imageData: new Uint8Array(fs.readFileSync(path.join(dir, file))), imageType: "image/jpeg" };
}
