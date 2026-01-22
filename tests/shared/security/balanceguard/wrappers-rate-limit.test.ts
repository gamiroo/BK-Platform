// tests/shared/security/balanceguard/wrappers-rate-limit.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { balanceguardClient } from "../../../../src/shared/security/balanceguard/wrappers.js";
import type { RequestContext } from "../../../../src/shared/logging/request-context.js";

test("balanceguardClient wrapper: rate limiting is enabled by default", async () => {
  // Using default policy (60/min). We'll just loop 61 times.
  const wrapped = balanceguardClient(async () => new Response("ok", { status: 200 }));

  const ctx = { request_id: "req_wrap_rl_1" } as unknown as RequestContext;
  const req = new Request("https://example.test/health", { method: "GET" });

  // 60 allowed
  for (let i = 0; i < 60; i += 1) {
    const r = await wrapped(ctx, req);
    assert.equal(r.status, 200);
  }

  // 61st should be rate limited
  const r61 = await wrapped(ctx, req);
  assert.equal(r61.status, 429);
});
