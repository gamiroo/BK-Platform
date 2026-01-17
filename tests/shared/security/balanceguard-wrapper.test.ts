import test from "node:test";
import assert from "node:assert/strict";

import { balanceguard } from "../../../src/shared/security/balanceguard/balanceguard.ts";
import { AppError } from "../../../src/shared/errors/app-error.ts";
import { createRequestContext } from "../../../src/shared/logging/request-context.ts";

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}


function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    prev[k] = process.env[k];
    const v = vars[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(vars)) {
      const v = prev[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("balanceguard: passes through handler response on success", async () => {
  const ctx = createRequestContext();
  const req = new Request("http://example.test/health", { method: "GET" });

  const wrapped = balanceguard({ surface: "site" }, async () => {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  });

  const res = await wrapped(ctx, req);
  assert.equal(res.status, 200);

  const body = await readJson<{ ok: boolean; request_id: string; error?: { code: string; message: string } }>(res);
  assert.equal(body.ok, true);
});

test("balanceguard: normalizes AppError into safe HTTP envelope", async () => {
  const ctx = createRequestContext();
  const req = new Request("http://example.test/x", { method: "GET" });

  const wrapped = balanceguard({ surface: "client" }, async () => {
    throw new AppError({ code: "FORBIDDEN", status: 403, message: "Nope" });
  });

  const res = await wrapped(ctx, req);
  assert.equal(res.status, 403);

  const body = await readJson<{ ok: boolean; request_id: string; error?: { code: string; message: string } }>(res);
  assert.equal(body.ok, false);
  assert.equal(body.request_id, ctx.request_id);
  assert.deepEqual(body.error, { code: "FORBIDDEN", message: "Nope" });
});

test("balanceguard: normalizes unknown errors into INTERNAL_ERROR 500 (no leakage)", async () => {
  const ctx = createRequestContext();
  const req = new Request("http://example.test/x", { method: "GET" });

  const wrapped = balanceguard({ surface: "admin" }, async () => {
    throw new Error("boom");
  });

  const res = await wrapped(ctx, req);
  assert.equal(res.status, 500);

  const body = await readJson<{ ok: boolean; request_id: string; error?: { code: string; message: string } }>(res);
  assert.equal(body.ok, false);
  assert.equal(body.request_id, ctx.request_id);
  assert.deepEqual(body.error, { code: "INTERNAL_ERROR", message: "Unexpected error" });
  assert.ok(!("stack" in body));
});

test("balanceguard: when requireOrigin=true, rejects missing allowlist in production (fails closed)", async () => {
  const ctx = createRequestContext();
  const req = new Request("http://example.test/x", { method: "GET", headers: { origin: "https://evil.test" } });

  await withEnv({ NODE_ENV: "production", BK_ORIGINS_CLIENT: undefined }, async () => {
    const wrapped = balanceguard({ surface: "client", requireOrigin: true }, async () => {
      return new Response("ok");
    });

    const res = await wrapped(ctx, req);
    assert.equal(res.status, 403);

    const body = await readJson<{ ok: boolean; request_id: string; error: { code: string; message: string } }>(res);
    assert.deepEqual(body.error, { code: "ORIGIN_REJECTED", message: "Origin rejected" });

  });
});
