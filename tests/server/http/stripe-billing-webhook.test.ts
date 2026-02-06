// tests/server/http/stripe-billing-webhook.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { withServer, readJson } from "./helpers/http.js";

/**
 * Transport-level contract tests:
 * - signature header required
 * - invalid signature rejected
 *
 * These do NOT require Stripe network calls.
 */
test("stripe billing webhook: missing stripe-signature => 400 normalized", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/webhooks/stripe/billing`, {
      method: "POST",
      headers: {
        // Note: webhook should NOT require Origin/CSRF/auth
        "content-type": "application/json",
      },
      body: JSON.stringify({ id: "evt_test_missing_sig", type: "invoice.paid" }),
    });

    assert.equal(res.status, 400);

    const body = await readJson(res);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "INPUT_INVALID"); // change if your code differs
  });
});

test("stripe billing webhook: invalid stripe-signature => 400 normalized", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/webhooks/stripe/billing`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=123,v1=not-a-real-signature",
      },
      body: JSON.stringify({ id: "evt_test_bad_sig", type: "invoice.paid" }),
    });

    assert.equal(res.status, 400);

    const body = await readJson(res);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "INPUT_INVALID"); // change if your code differs
  });
});
