// src/shared/db/env-marker.ts
/**
 * DB environment marker (operational safety).
 *
 * Contract:
 * - The database stores a single marker row in `bk_env_marker`:
 *   env = "dev" | "prod"
 *
 * Why:
 * - Prevents migrating the wrong DB (prod vs dev).
 *
 * Rules:
 * - runtime NODE_ENV maps to marker:
 *   - development/test => "dev"
 *   - production       => "prod"
 * - If VERCEL_ENV=production, expected marker MUST be "prod".
 *
 * Bootstrap:
 * - `scripts/db-bootstrap-env-marker.ts` must ensure the table exists + row id=1
 *   before running db-safety-check or migrations.
 */


import { AppError } from "../errors/app-error.js";
import { loadEnv } from "../config/env.js";
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
    details: { value: raw, expected: ["dev", "prod"] },
  });
}

export function expectedMarkerFromRuntime(input: RuntimeEnvInput): DbEnvMarker {
  if (input.vercel_env === "production") return "prod";

  switch (input.node_env) {
    case "production":
      return "prod";
    case "development":
    case "test":
      return "dev";
    default: {
      const _exhaustive: never = input.node_env;
      return _exhaustive;
    }
  }
}

function isMissingRelationError(err: unknown): boolean {
  // postgres error code 42P01 = undefined_table
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "42P01"
  );
}

export async function readDbEnvMarker(h: DbHandle): Promise<DbEnvMarker> {
  try {
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
        message: "Database env marker missing row",
        details: { table: "bk_env_marker", id: 1 },
      });
    }

    return parseDbEnvMarker(row.env);
  } catch (err) {
    if (isMissingRelationError(err)) {
      throw new AppError({
        code: "INTERNAL_ERROR",
        status: 500,
        message: "Database env marker table missing",
        details: {
          table: "bk_env_marker",
          fix: "Run pnpm db:bootstrap:dev (or apply initial migrations) before running db:safety-check.",
        },
      });
    }
    throw err;
  }
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
