// src/shared/db/env-marker.ts
/**
 * DB environment marker (operational safety).
 *
 * Contract:
 * - The database stores a single marker row in `bk_env_marker`:
 *   env = "dev" | "prod"
 *
 * Why:
 * - This prevents the #1 accident: migrating the wrong database.
 *
 * Rules:
 * - runtime NODE_ENV is mapped to marker:
 *   - development/test => "dev"
 *   - production       => "prod"
 * - If VERCEL_ENV=production, expected marker MUST be "prod"
 */

import { AppError } from "../errors/app-error.js";
import { loadEnv } from "../config/env.ts";
import type { DbHandle } from "./client.js";

export type DbEnvMarker = "dev" | "prod";

export type RuntimeEnvInput = Readonly<{
  node_env: "development" | "test" | "production";
  vercel_env?: "production" | "preview" | "development";
}>;

export function runtimeEnvInput(): RuntimeEnvInput {
  const env = loadEnv();

  const out: {
    node_env: RuntimeEnvInput["node_env"];
    vercel_env?: NonNullable<RuntimeEnvInput["vercel_env"]>;
  } = { node_env: env.NODE_ENV };

  if (env.VERCEL_ENV !== undefined) out.vercel_env = env.VERCEL_ENV;
  return out;
}

export function parseDbEnvMarker(raw: string): DbEnvMarker {
  if (raw === "dev" || raw === "prod") return raw;

  throw new AppError({
    code: "INTERNAL_ERROR",
    status: 500,
    message: "Database env marker invalid",
    details: { value: raw },
  });
}

export function expectedMarkerFromRuntime(input: RuntimeEnvInput): DbEnvMarker {
  // Vercel production must always target prod DB.
  if (input.vercel_env === "production") return "prod";

  switch (input.node_env) {
    case "production":
      return "prod";
    case "development":
    case "test":
      return "dev";
    default: {
      // Exhaustive guard for future TS widening
      const _exhaustive: never = input.node_env;
      return _exhaustive;
    }
  }
}

export async function readDbEnvMarker(h: DbHandle): Promise<DbEnvMarker> {
  // Expect exactly one marker row (id = 1). Keep SQL minimal and infra-only.
  const rows = await h.sql<{ env: string }[]>`
    select env
    from bk_env_marker
    where id = 1
    limit 1
  `;

  const row = rows[0];
  if (!row) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      status: 500,
      message: "Database env marker missing",
      details: { table: "bk_env_marker", id: 1 },
    });
  }

  return parseDbEnvMarker(row.env);
}

export function assertDbEnvMarker(expected: DbEnvMarker, actual: DbEnvMarker): void {
  if (expected !== actual) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      status: 500,
      message: "Database env marker mismatch",
      details: { expected, actual },
    });
  }
}
