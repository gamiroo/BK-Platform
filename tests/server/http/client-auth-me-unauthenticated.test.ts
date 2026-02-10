import test from "node:test";
import assert from "node:assert/strict";

import { withServer, readJson } from "./helpers/http.ts";

/**
 * Contract: unauthenticated /api/client/auth/me returns a stable, safe envelope.
 *
 * This test is intentionally redundant with `client-auth-me.test.ts`.
 * It focuses on security invariants (no stack/diagnostic leaks).
 */
test("GET /api/client/auth/me unauthenticated returns stable envelope (no leaks)", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/client/auth/me`, {
      method: "GET",
      headers: { accept: "application/json" },
    });

    assert.equal(res.status, 401);

    const body = await readJson(res);

    assert.equal(body.ok, false);
    assert.equal(typeof body.request_id, "string");
    assert.equal(typeof body.error.code, "string");
    assert.equal(typeof body.error.message, "string");

    assert.ok(!("stack" in (body.error as unknown as Record<string, unknown>)));
    assert.ok(!body.error.message.includes("\n    at "), "expected no stack trace in message");
  });
});
