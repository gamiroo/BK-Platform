import test from "node:test";
import assert from "node:assert/strict";

import { applySecurityHeaders } from "../../../src/shared/http/headers.ts";

function makeRes(): Response {
  return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
}

test("applySecurityHeaders: sets baseline hardening headers", () => {
  const res = applySecurityHeaders(makeRes());

  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.equal(res.headers.get("referrer-policy"), "no-referrer");
  assert.ok(res.headers.get("permissions-policy"));
  assert.equal(res.headers.get("cross-origin-opener-policy"), "same-origin");
  assert.equal(res.headers.get("cross-origin-resource-policy"), "same-origin");
});

test("applySecurityHeaders: preserves original status and content-type", () => {
  const res = applySecurityHeaders(makeRes());
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/plain");
});
