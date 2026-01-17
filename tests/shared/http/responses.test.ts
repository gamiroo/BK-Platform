import test from "node:test";
import assert from "node:assert/strict";

import { json, jsonError } from "../../../src/shared/http/responses.ts";
import { createRequestContext } from "../../../src/shared/logging/request-context.ts";

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

test("json: returns ok=true envelope with request_id and data", async () => {
  const ctx = createRequestContext();
  const res = json(ctx, { hello: "world" });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(res.headers.get("x-request-id"), ctx.request_id);

  const body = await readJson<{ ok: boolean; request_id: string; error?: { code: string; message: string }; data: string }>(res);
  assert.equal(body.ok, true);
  assert.equal(body.request_id, ctx.request_id);
  assert.deepEqual(body.data, { hello: "world" });
});

test("jsonError: returns ok=false envelope with request_id and error(code/message)", async () => {
  const ctx = createRequestContext();
  const res = jsonError(ctx, 404, "NOT_FOUND", "Nope");

  assert.equal(res.status, 404);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(res.headers.get("x-request-id"), ctx.request_id);

  const body = await readJson<{ ok: boolean; request_id: string; error?: { code: string; message: string } }>(res);
  assert.equal(body.ok, false);
  assert.equal(body.request_id, ctx.request_id);
  assert.deepEqual(body.error, { code: "NOT_FOUND", message: "Nope" });
});
