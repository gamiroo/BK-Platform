// drizzle.config.ts
// Drizzle Kit config for migrations + schema generation.
// This is intentionally simple and environment-driven.
// - Never hardcode secrets in this file.
// - `DATABASE_URL` must be present in your environment when running drizzle-kit.

import type { Config } from "drizzle-kit";

export default {
  schema: "./src/shared/db/schema/**/*.ts",
  out: "./src/shared/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
} satisfies Config;
