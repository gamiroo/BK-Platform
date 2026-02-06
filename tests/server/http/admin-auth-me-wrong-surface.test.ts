import test from "node:test";
import assert from "node:assert/strict";

import { withServer, readJson } from "./helpers/http.ts";

/**
 * Contract: WRONG_SURFACE must be explicit and safe.
 *
 * Why this matters:
 * - Prevents the "client cookie" from being accepted on the admin surface.
 * - Produces actionable but safe diagnostics (error.details) for debugging.
 */
test("GET /api/admin/auth/me with client cookie => 403 WRONG_SURFACE + safe details", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/admin/auth/me`, {
      method: "GET",
      headers: {
        accept: "application/json",
        // A client cookie presented to admin surface must be rejected.
        cookie: "bk_client_session=some_client_cookie",
      },
    });

    assert.equal(res.status, 403);

    const body = await readJson(res);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "WRONG_SURFACE");

    // Wrong-surface must include safe diagnostics for debugging.
    assert.ok(body.error.details !== undefined, "expected error.details");

    // No internal leaks
    assert.ok(!("stack" in (body.error as unknown as Record<string, unknown>)));
  });
});
