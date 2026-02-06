// scripts/db-bootstrap-env-marker.ts
/**
 * Bootstraps bk_env_marker so db-safety-check can run BEFORE migrations.
 *
 * This script is intentionally infra-only and uses raw SQL:
 * - CREATE TABLE IF NOT EXISTS (idempotent)
 * - Upsert row id=1
 */

import { createDb } from "../src/shared/db/client.js";
import { expectedMarkerFromRuntime, runtimeEnvInput } from "../src/shared/db/env-marker.js";

function nowIso(): string {
  return new Date().toISOString();
}

async function main(): Promise<void> {
  const h = createDb();
  try {
    const expected = expectedMarkerFromRuntime(runtimeEnvInput());
    console.log(`[db-bootstrap-env-marker] ${nowIso()} expected=${expected}`);

    // 1) Create table if needed (idempotent)
    await h.sql`
      create table if not exists bk_env_marker (
        id integer primary key default 1 not null,
        env text not null,
        updated_at timestamptz not null default now()
      )
    `;

    // 2) Ensure row id=1 exists (upsert)
    await h.sql`
      insert into bk_env_marker (id, env, updated_at)
      values (1, ${expected}, now())
      on conflict (id)
      do update set env = excluded.env, updated_at = now()
    `;

    console.log("[db-bootstrap-env-marker] ok");
  } finally {
    await h.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
