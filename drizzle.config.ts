// drizzle.config.ts
/**
 * Drizzle Kit configuration (canonical).
 *
 * Source-of-truth schema lives in:
 *   `src/shared/db/schema/index.ts`
 *
 * Generated migrations are written to:
 *   `drizzle/`
 *
 * Notes:
 * - Drizzle Kit only needs DATABASE_URL when running migrate/introspect.
 * - We avoid throwing at import time so CI lint/typecheck can run safely even without DATABASE_URL.
 */

import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "";

if (!url) {
  // Do not throw here; CI may lint/typecheck without DB credentials.
  // Commands that require DB connectivity (migrate/introspect) will fail fast at runtime.
  console.warn("[drizzle.config] DATABASE_URL is not set (ok for CI lint/typecheck).");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/shared/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url,
  },
  // Optional: enables nice output for generated migrations
  verbose: true,
  strict: true,
});
