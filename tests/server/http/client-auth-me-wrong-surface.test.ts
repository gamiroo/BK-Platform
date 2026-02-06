import test from "node:test";
import assert from "node:assert/strict";

import { withServer, readJson } from "./helpers/http.ts";

/**
 * Contract: client surface must reject admin cookies with WRONG_SURFACE.
 */
test("GET /api/client/auth/me with admin cookie => 403 WRONG_SURFACE + safe details", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/client/auth/me`, {
      method: "GET",
      headers: {
        accept: "application/json",
        cookie: "bk_admin_session=some_admin_cookie",
      },
    });

    assert.equal(res.status, 403);

    const body = await readJson(res);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "WRONG_SURFACE");
    assert.ok(body.error.details !== undefined, "expected error.details");
    assert.ok(!("stack" in (body.error as unknown as Record<string, unknown>)));
  });
});
