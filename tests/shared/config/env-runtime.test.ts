// tests/shared/config/env-runtime.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { loadRuntimeEnv } from "../../../src/shared/config/env.js";

test("loadRuntimeEnv: does not require DATABASE_URL", () => {
  const prev = { ...process.env };

  try {
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
    delete process.env.VERCEL_ENV;

    const env = loadRuntimeEnv();
    assert.ok(env.NODE_ENV);
    assert.equal(env.REDIS_URL, undefined);
  } finally {
    process.env = prev;
  }
});
