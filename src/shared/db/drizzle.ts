// src/shared/db/drizzle.ts
// Drizzle ORM connection builder.
// Keep this isolated: application code uses the exported `db` accessors,
// not raw Pool queries.

import { drizzle } from "drizzle-orm/node-postgres";
import { getPgPool } from "./client.js";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;
  const pool = getPgPool();
  _db = drizzle(pool);
  return _db;
}
