// scripts/db-ping.ts
/**
 * DB sanity ping (safe).
 *
 * - Connects using DATABASE_URL
 * - Executes a small query and prints a non-sensitive fingerprint
 *
 * NOTE: Do not log DATABASE_URL. Ever.
 */

import { Client } from "pg";
import { loadEnv } from "../src/shared/config/env.ts";

async function main(): Promise<void> {
  const env = loadEnv();

  const client = new Client({
    connectionString: env.DATABASE_URL,
    // Neon requires TLS. This is a pragmatic default for dev tooling.
    // In production runtimes, TLS is handled by the platform and pg.
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  const marker = await client.query<{ env: string }>("select env from bk_env_marker where id = 1");
  console.log({ env_marker: marker.rows[0]?.env ?? "missing" });


  const { rows } = await client.query<{
    now: string;
    current_database: string;
    current_user: string;
    inet_server_addr: string | null;
  }>(`
    select
      now()::text as now,
      current_database() as current_database,
      current_user as current_user,
      inet_server_addr()::text as inet_server_addr
  `);

  const r = rows[0];
  console.log({
    now: r?.now,
    db: r?.current_database,
    user: r?.current_user,
    server: r?.inet_server_addr,
  });

  await client.end();
}

main().catch((err) => {
  console.error("db-ping failed:", err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
