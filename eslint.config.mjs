import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Tenant isolation rules. The raw database client is not scoped to a shop, so application code must go through
// `withShop` / `asPlatform` (src/lib/tenant.ts). String-built SQL is banned outright: every query must be parameterised.
const appRules = {
  "no-restricted-imports": [
    "error",
    { paths: [{ name: "@/lib/db", message: "Use withShop()/asPlatform() from @/lib/tenant so queries are scoped to a shop." }] },
  ],
  "no-restricted-syntax": [
    "error",
    { selector: "MemberExpression[property.name=/^\\$(query|execute)RawUnsafe$/]", message: "String-built SQL is not allowed. Use tagged-template $queryRaw / $executeRaw." },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { files: ["src/**/*.{ts,tsx}"], ignores: ["src/lib/tenant.ts"], rules: appRules },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
