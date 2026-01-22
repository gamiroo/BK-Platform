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

import postgres, { type Sql } from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { loadEnv } from "../config/env.ts";

export type Db = PostgresJsDatabase;

export type DbHandle = Readonly<{
  db: Db;

  /**
   * Raw SQL channel (for early infra checks like env marker + migrations verification).
   * Keep its usage infra-only.
   */
  sql: Sql;

  /**
   * Close the underlying driver connection.
   * In serverless, this typically isn't required per invocation,
   * but is useful for scripts/tests.
   */
  close: () => Promise<void>;
}>;

/**
 * Create a DB handle for the current runtime.
 *
 * In serverless environments, creating a client per invocation is acceptable if:
 * - you use pooled/proxied connection strings (Neon pooled)
 * - you don't hold long-lived connections unnecessarily
 */
export function createDb(): DbHandle {
  const env = loadEnv();

  const sql = postgres(env.DATABASE_URL, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: "require",
  });

  const db = drizzle(sql);

  return {
    db,
    sql,
    close: async () => {
      await sql.end({ timeout: 5 });
    },
  };
}
