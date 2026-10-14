// Renders prisma/product-images/*.jpg (600x400) from the illustrations in products.mjs, plus manifest.json.
// Requires Playwright with Chromium:  NODE_PATH=$(npm root -g) node tools/product-images/generate.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { BG, PRODUCTS, slug } from "./products.mjs";
import { shadow } from "./shapes.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const out = path.resolve(import.meta.dirname, "../../prisma/product-images");
fs.mkdirSync(out, { recursive: true });

const only = process.argv[2]; // optional: render a single product by name fragment
const svgFor = (name, cat, art) => {
  const [a, b] = BG[cat];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="600" height="400" fill="url(#bg)"/><circle cx="300" cy="200" r="168" fill="#fff" opacity="0.42"/>
  <g transform="translate(300 198) scale(1.12)">${shadow(250, 146)}${art()}</g></svg>`;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 400 } });
const manifest = {};
for (const [name, cat, art] of PRODUCTS) {
  const file = `${slug(name)}.jpg`;
  manifest[name] = file;
  if (only && !name.toLowerCase().includes(only.toLowerCase())) continue;
  await page.setContent(`<body style="margin:0">${svgFor(name, cat, art)}</body>`);
  await page.screenshot({ path: path.join(out, file), type: "jpeg", quality: 90, clip: { x: 0, y: 0, width: 600, height: 400 } });
}
await browser.close();
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`rendered ${only ? "filtered" : PRODUCTS.length} images -> ${out}`);
