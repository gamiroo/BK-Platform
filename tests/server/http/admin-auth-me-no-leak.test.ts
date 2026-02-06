import test from "node:test";
import assert from "node:assert/strict";

import { withServer, readJson } from "./helpers/http.ts";

/**
 * Contract: unauthenticated /auth/me must be stable and safe.
 *
 * This is intentionally “extra” coverage beyond `admin-auth-me.test.ts`.
 * The goal is to lock the invariant that error payloads never leak internals.
 */
test("admin /auth/me: unauthenticated envelope is stable + no stack leak", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/admin/auth/me`, {
      method: "GET",
      headers: { accept: "application/json" },
    });

    assert.equal(res.status, 401);

    const body = await readJson(res);
    assert.equal(body.ok, false);

    assert.ok(typeof body.error.code === "string");
    assert.ok(typeof body.error.message === "string");

    // No stack traces or diagnostic strings that look like stack frames.
    assert.ok(!("stack" in (body.error as unknown as Record<string, unknown>)));
    assert.ok(!body.error.message.includes("\n    at "), "expected no stack trace in message");
  });
});
