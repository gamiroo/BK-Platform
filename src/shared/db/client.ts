// src/shared/db/client.ts
// Creates the low-level Postgres client connection.
// - Keep this isolated in `shared/db` so infrastructure does not leak into domain.
// - Reuse a singleton in production environments to avoid exhausting connections.

import { Pool } from "pg";

let pool: Pool | null = null;

export function getPgPool(): Pool {
  if (pool) return pool;

  // Intentionally avoid calling loadEnv() here:
  // - DB creation should only require DATABASE_URL for now
  // - loadEnv() will be used once DATABASE_URL is promoted into Env type


  // NOTE: DATABASE_URL isn't in the minimal env.ts stub yet.
  // Add it when you start schema work, then uncomment this:
  // const databaseUrl = requireEnv("DATABASE_URL");

  // For Day 0, we allow creating the pool lazily once DATABASE_URL exists.
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to create the Postgres pool.");
  }

  pool = new Pool({
    connectionString: databaseUrl,
    // Recommended baseline settings:
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Neon can benefit from SSL depending on config; adjust later if needed.
    ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  // Optional: crash fast on unhandled pool errors
  pool.on("error", (err) => {
    // In production you might want to log and exit (depending on your ops model)
    console.error("Postgres pool error:", err);
  });

  return pool;
}
