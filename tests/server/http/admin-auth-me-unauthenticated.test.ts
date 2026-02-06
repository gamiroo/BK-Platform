import test from "node:test";
import assert from "node:assert/strict";

import { withServer, readJson } from "./helpers/http.ts";

/**
 * Contract: unauthenticated /api/admin/auth/me returns a stable, safe envelope.
 *
 * Why keep this when `admin-auth-me.test.ts` already asserts unauthenticated?
 * - This test focuses specifically on “no leaks” invariants (no stack traces)
 *   and is a convenient place to add additional envelope-safety assertions later.
 *
 * Note:
 * - Server tests use Node's global `fetch()`.
 * - The frontend http-client is a browser policy and is not used here.
 */
test("GET /api/admin/auth/me unauthenticated returns stable envelope (no leaks)", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/admin/auth/me`, {
      method: "GET",
      headers: { accept: "application/json" },
    });

    // Contract: unauthenticated => 401
    assert.equal(res.status, 401);

    const body = await readJson(res);

    // Canonical failure envelope
    assert.equal(body.ok, false);
    assert.equal(typeof body.request_id, "string");
    assert.equal(typeof body.error.code, "string");
    assert.equal(typeof body.error.message, "string");

    // Explicit no-leak assertions
    assert.ok(!("stack" in (body.error as unknown as Record<string, unknown>)));
    assert.ok(!body.error.message.includes("\n    at "), "expected no stack trace in message");
  });
});
