// tests/shared/db/db.ts
import { createDb } from "../../../src/shared/db/client.js";

/**
 * Minimal DB helper for tests.
 * Uses the real configured database (dev/test env), consistent with your current approach.
 *
 * IMPORTANT:
 * - These tests assume the DB is already migrated.
 * - Keep tests idempotent (they clean up after themselves).
 */
export function testDb() {
  return createDb();
}
