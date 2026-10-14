import path from "node:path";
import { defineConfig } from "vitest/config";

// Integration tests run against their OWN database (never the dev/production one).
const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgresql://pos:pos@localhost:5432/pos_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"), // the real package throws outside Next.js
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/setup/global.ts"],
    env: { DATABASE_URL: TEST_DB, DATABASE_URL_UNPOOLED: TEST_DB, SESSION_SECRET: "test-secret-test-secret-test-secret-0123456789" },
    fileParallelism: false, // the integration files share one database
    testTimeout: 30_000,
  },
});
