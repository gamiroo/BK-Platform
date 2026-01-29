import test from "node:test";
import assert from "node:assert/strict";

import { toHttpErrorResponse } from "../../../src/shared/errors/http-error-response.ts";
import type { NormalizedError } from "../../../src/shared/errors/normalize-error.ts";
import { createRequestContext } from "../../../src/shared/logging/request-context.ts";

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  assert.ok(text.length > 0, "expected JSON response body");
  return JSON.parse(text) as T;
}

test("toHttpErrorResponse: returns JSON envelope with ok=false + request_id + error(code/message)", async () => {
  const ctx = createRequestContext();
  const n: NormalizedError = {
    code: "FORBIDDEN",
    status: 403,
    publicMessage: "Nope",
    logMessage: "FORBIDDEN: Nope",
  };

  const res = toHttpErrorResponse(ctx, n);

  assert.equal(res.status, 403);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(res.headers.get("x-request-id"), ctx.request_id);

  const body = await readJson<{ ok: boolean; request_id: string; error?: { code: string; message: string } }>(res);
  assert.equal(body.ok, false);
  assert.equal(body.request_id, ctx.request_id);
  assert.deepEqual(body.error, { code: "FORBIDDEN", message: "Nope" });
});

test("toHttpErrorResponse: may include error.details for safe, expected errors", async () => {
  const ctx = createRequestContext();
  const n: NormalizedError = {
    code: "WRONG_SURFACE",
    status: 403,
    publicMessage: "Wrong surface",
    logMessage: "WRONG_SURFACE: Wrong surface",
    details: { expected_cookie: "bk_admin_session", got_cookie: "bk_client_session" },
  };

  const res = toHttpErrorResponse(ctx, n);
  const body = await readJson<{
    ok: boolean;
    request_id: string;
    error: { code: string; message: string; details?: unknown };
  }>(res);

  assert.equal(body.ok, false);
  assert.equal(body.request_id, ctx.request_id);
  assert.equal(body.error.code, "WRONG_SURFACE");
  assert.equal(body.error.message, "Wrong surface");
  assert.deepEqual(body.error.details, {
    expected_cookie: "bk_admin_session",
    got_cookie: "bk_client_session",
  });
});

test("toHttpErrorResponse: never exposes error.details for INTERNAL_ERROR", async () => {
  const ctx = createRequestContext();
  const n: NormalizedError = {
    code: "INTERNAL_ERROR",
    status: 500,
    publicMessage: "Unexpected error",
    logMessage: "some internal detail",
    details: { name: "Error", stack: "do not leak" },
  };

  const res = toHttpErrorResponse(ctx, n);
  const body = await readJson<{ ok: boolean; request_id: string; error: { code: string; message: string; details?: unknown } }>(
    res
  );

  assert.equal(body.ok, false);
  assert.equal(body.error.code, "INTERNAL_ERROR");
  assert.equal(body.error.message, "Unexpected error");
  assert.ok(!("details" in body.error), "did not expect error.details for INTERNAL_ERROR");
});
