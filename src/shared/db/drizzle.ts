// src/shared/db/drizzle.ts
/**
 * Convenience DB accessor for application code that wants a Db handle.
 *
 * IMPORTANT:
 * - This module must not connect at import time.
 * - It provides a small adapter around `createDb()` which returns `{ db, close }`.
 *
 * Use cases:
 * - scripts / one-off jobs can call `const { db, close } = getDb(); ... await close();`
 * - serverless handlers can create per-invocation and close at end (or later we can memoize)
 */

import type { Db } from "./client.js";
import { createDb } from "./client.js";

export function getDb(): { db: Db; close: () => Promise<void> } {
  return createDb();
}
