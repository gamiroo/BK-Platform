// tests/shared/security/balanceguard/balanceguard-identity-authz.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { balanceguard } from "../../../../src/shared/security/balanceguard/balanceguard.js";
import type { RequestContext } from "../../../../src/shared/logging/request-context.js";
import type { Actor } from "../../../../src/shared/security/balanceguard/types.js";

test("balanceguard: when client surface has anon actor, returns AUTH_REQUIRED 401", async () => {
  // NOTE:
  // In tests we stub the RequestContext minimal shape needed by the HTTP envelope:
  // `toHttpErrorResponse()` reads ctx.request_id to include it in:
  //   - response header: x-request-id
  //   - response body:   { request_id: ... }
  const ctx = { request_id: "req_auth_1" } as unknown as RequestContext;
  const req = new Request("https://example.test/x", { method: "GET" });

  const handler = balanceguard(
    {
      surface: "client",
      resolveActor: async () => ({ type: "anon" } satisfies Actor),
    },
    async () => new Response("ok", { status: 200 })
  );

  const res = await handler(ctx, req);
  assert.equal(res.status, 401);

  const body = (await res.json()) as unknown as {
    ok: boolean;
    request_id: string;
    error: { code: string; message: string; details?: unknown };
  };

  assert.equal(body.ok, false);
  assert.equal(body.request_id, "req_auth_1");
  assert.equal(body.error.code, "AUTH_REQUIRED");
});

test("balanceguard: when client surface has client actor, handler runs", async () => {
  const ctx = { request_id: "req_auth_2" } as unknown as RequestContext;
  const req = new Request("https://example.test/x", { method: "GET" });

  const handler = balanceguard(
    {
      surface: "client",
      resolveActor: async () => ({ type: "client", client_id: "c1" } satisfies Actor),
    },
    async () => new Response("ok", { status: 200 })
  );

  const res = await handler(ctx, req);
  assert.equal(res.status, 200);
});

test("balanceguard: site surface allows anon by default", async () => {
  const ctx = { request_id: "req_auth_3" } as unknown as RequestContext;
  const req = new Request("https://example.test/x", { method: "GET" });

  const handler = balanceguard(
    {
      surface: "site",
      resolveActor: async () => ({ type: "anon" } satisfies Actor),
    },
    async () => new Response("ok", { status: 200 })
  );

  const res = await handler(ctx, req);
  assert.equal(res.status, 200);
});
