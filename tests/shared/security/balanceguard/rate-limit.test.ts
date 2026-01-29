// tests/shared/security/balanceguard/rate-limit.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { createInMemoryRateLimitStore, enforceRateLimitHttp } from "../../../../src/shared/security/balanceguard/rate-limit.js";

test("rate limit: allows up to max within window, then throws RATE_LIMITED", async () => {
  const store = createInMemoryRateLimitStore();

  const input = {
    surface: "client",
    ip: "203.0.113.10",
    routeKey: "GET:/api/client/health",
    max: 3,
    windowMs: 60_000,
    store,
  } as const;

  // 1..3 allowed
  await enforceRateLimitHttp(input);
  await enforceRateLimitHttp(input);
  await enforceRateLimitHttp(input);

  // 4th should throw
  await assert.rejects(
    async () => enforceRateLimitHttp(input),
    (err: unknown) => {
      const e = err as { code?: unknown; status?: unknown };
      assert.equal(e.code, "RATE_LIMITED");
      assert.equal(e.status, 429);
      return true;
    }
  );
});
