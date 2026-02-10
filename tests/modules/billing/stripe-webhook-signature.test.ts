import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { verifyStripeWebhookSignature } from "../../../src/modules/billing/infrastructure/stripe/stripe_webhook_verifier.js";

function makeHeader(secret: string, tsSec: number, raw: Uint8Array): string {
  const signed = Buffer.concat([Buffer.from(String(tsSec) + "."), Buffer.from(raw)]);
  const sig = createHmac("sha256", secret).update(signed).digest("hex");
  return `t=${tsSec},v1=${sig}`;
}

test("verifyStripeWebhookSignature accepts valid signature within tolerance", () => {
  const secret = "whsec_test";
  const raw = new TextEncoder().encode(
    JSON.stringify({
      id: "evt_1",
      type: "charge.succeeded",
      created: 123,
      livemode: false,
      data: { object: { id: "ch_1", amount: 100, currency: "aud", created: 123 } },
    })
  );

  const nowMs = 1700000000000;
  const tsSec = Math.floor(nowMs / 1000);
  const header = makeHeader(secret, tsSec, raw);

  const res = verifyStripeWebhookSignature({
    rawBody: raw,
    signatureHeader: header,
    secret,
    nowMs,
    toleranceSec: 300,
  });

  assert.equal(res.ok, true);
});

test("verifyStripeWebhookSignature rejects missing header", () => {
  const res = verifyStripeWebhookSignature({
    rawBody: new Uint8Array(),
    signatureHeader: null,
    secret: "whsec_test",
    nowMs: Date.now(),
    toleranceSec: 300,
  });

  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.code, "STRIPE_SIGNATURE_MISSING");
});

test("verifyStripeWebhookSignature rejects timestamp outside tolerance", () => {
  const secret = "whsec_test";
  const raw = new TextEncoder().encode("{}");
  const nowMs = 1700000000000;
  const oldTs = Math.floor(nowMs / 1000) - 1000;
  const header = makeHeader(secret, oldTs, raw);

  const res = verifyStripeWebhookSignature({
    rawBody: raw,
    signatureHeader: header,
    secret,
    nowMs,
    toleranceSec: 300,
  });

  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.code, "STRIPE_SIGNATURE_TIMESTAMP_OUT_OF_RANGE");
});
