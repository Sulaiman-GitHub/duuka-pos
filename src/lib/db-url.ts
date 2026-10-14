// Hosts name the connection-string variable differently (Vercel's Neon integration can add a prefix),
// so accept the common names rather than failing on a naming difference.
const pick = (...names: string[]) => names.map((n) => process.env[n]).find(Boolean) ?? "";

export const databaseUrl = () => pick("DATABASE_URL", "POSTGRES_URL", "STORAGE_URL", "STORAGE_POSTGRES_URL");

/** Direct (non-pooled) connection, preferred for migrations. */
export const directDatabaseUrl = () =>
  pick("DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "STORAGE_URL_UNPOOLED", "STORAGE_POSTGRES_URL_NON_POOLING") || databaseUrl();
