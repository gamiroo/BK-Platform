// src/shared/db/client.ts
/**
 * DB client factory (canonical).
 *
 * Uses:
 * - postgres (postgres-js) as the driver
 * - drizzle-orm/postgres-js as the ORM
 *
 * Rules:
 * - Never read process.env directly outside `src/shared/config/env.ts`.
 * - Do not connect at import time.
 * - Keep this module infrastructure-only (no business logic).
 */

import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { loadEnv } from "../config/env.ts";

export type Db = PostgresJsDatabase;

/**
 * Create a new DB connection for the current runtime.
 *
 * In serverless environments, creating a client per invocation is acceptable if:
 * - you use pooled/proxied connection strings (Neon pooled)
 * - you don't hold long-lived connections in memory unnecessarily
 *
 * As the project grows, we can add smarter memoization per runtime/bundle.
 */
export function createDb(): { db: Db; close: () => Promise<void> } {
  const env = loadEnv();

  const sql = postgres(env.DATABASE_URL, {
    // Keep defaults conservative; Neon pooled URLs handle pooling/proxying.
    // Increase/decrease as your workload grows.
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: "require",
  });

  const db = drizzle(sql);

  return {
    db,
    close: async () => {
      await sql.end({ timeout: 5 });
    },
  };
}
