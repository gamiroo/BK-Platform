// scripts/db-safety-check.ts
/**
 * DB safety check (environment marker).
 *
 * Fails non-zero if the connected DB does not match the expected runtime env.
 */

import { createDb } from "../src/shared/db/client.js";
import { readDbEnvMarker, assertDbEnvMarker, expectedMarkerFromRuntime, runtimeEnvInput } from "../src/shared/db/env-marker.js";

async function main(): Promise<void> {
  const h = createDb();

  try {
    const expected = expectedMarkerFromRuntime(runtimeEnvInput());
    const actual = await readDbEnvMarker(h);

    assertDbEnvMarker(expected, actual);

    console.log(JSON.stringify({ ok: true, expected, actual }, null, 2));
  } finally {
    await h.close();
  }
}

void main();
