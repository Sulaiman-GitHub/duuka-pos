import "dotenv/config";
import { defineConfig } from "prisma/config";
import { directDatabaseUrl } from "./src/lib/db-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations should use a direct (non-pooled) connection when the host provides one (Neon does).
    url: directDatabaseUrl(),
  },
});
