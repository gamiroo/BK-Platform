// tests/shared/security/balanceguard/balanceguard-rate-limit.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { balanceguard } from "../../../../src/shared/security/balanceguard/balanceguard.js";
import { createInMemoryRateLimitStore } from "../../../../src/shared/security/balanceguard/rate-limit.js";

test("BalanceGuard: rate limiting is enforced before handler", async () => {
  const store = createInMemoryRateLimitStore();

  const wrapped = balanceguard(
    {
      surface: "client",
      requireOrigin: false,
      requireCsrf: false,
      rateLimit: {
        store,
        max: 2,
        windowMs: 60_000,
      },
    },
    async () => new Response("ok", { status: 200 })
  );

  const ctx = { request_id: "req_test_1" } as unknown as import("../../../../src/shared/logging/request-context.js").RequestContext;

  const req = new Request("https://example.com/api/client/health", { method: "GET" });

  const r1 = await wrapped(ctx, req);
  assert.equal(r1.status, 200);

  const r2 = await wrapped(ctx, req);
  assert.equal(r2.status, 200);

  const r3 = await wrapped(ctx, req);
  assert.equal(r3.status, 429);

  const body = await r3.json();
  // Expect your standard http error envelope shape;
  // at minimum it should include request_id and a code.
  assert.ok(body);
});
