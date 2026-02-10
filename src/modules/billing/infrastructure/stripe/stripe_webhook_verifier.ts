import { createHmac, timingSafeEqual } from "node:crypto";
import type { StripeWebhookVerifier } from "../../application/ports/stripe.port.js";

function parseStripeSignatureHeader(header: string): { timestampSec: number; v1: string[] } | null {
  // Stripe: "t=1492774577,v1=5257a8...,v0=..."
  const parts = header.split(",").map((p) => p.trim()).filter(Boolean);
  const map = new Map<string, string[]>();

  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx <= 0) return null;
    const k = part.slice(0, idx);
    const v = part.slice(idx + 1);
    const arr = map.get(k) ?? [];
    arr.push(v);
    map.set(k, arr);
  }

  const tRaw = map.get("t")?.[0];
  const v1 = map.get("v1") ?? [];
  const t = tRaw ? Number(tRaw) : NaN;

  if (!Number.isFinite(t) || v1.length === 0) return null;
  return { timestampSec: t, v1 };
}

function computeSignature(secret: string, signedPayload: Uint8Array): Buffer {
  return createHmac("sha256", secret).update(signedPayload).digest();
}

function hexToBuf(hex: string): Buffer | null {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null;
  try {
    return Buffer.from(hex, "hex");
  } catch {
    return null;
  }
}

/**
 * Stripe signature verification algorithm:
 * - signed_payload = `${t}.${raw_body}`
 * - expected = HMAC_SHA256(secret, signed_payload)
 * - compare against any v1 signatures
 * - enforce timestamp tolerance
 */
export const verifyStripeWebhookSignature: StripeWebhookVerifier = (args) => {
  const { rawBody, signatureHeader, secret, nowMs, toleranceSec } = args;

  if (!signatureHeader) {
    return { ok: false, code: "STRIPE_SIGNATURE_MISSING", message: "Missing stripe-signature header." };
  }

  const parsed = parseStripeSignatureHeader(signatureHeader);
  if (!parsed) {
    return { ok: false, code: "STRIPE_SIGNATURE_INVALID_FORMAT", message: "Invalid stripe-signature header format." };
  }

  const { timestampSec, v1 } = parsed;

  const nowSec = Math.floor(nowMs / 1000);
  const diff = Math.abs(nowSec - timestampSec);
  if (diff > toleranceSec) {
    return {
      ok: false,
      code: "STRIPE_SIGNATURE_TIMESTAMP_OUT_OF_RANGE",
      message: "Stripe signature timestamp outside tolerance.",
      details: { tolerance_sec: toleranceSec, delta_sec: diff },
    };
  }

  const prefix = new TextEncoder().encode(`${timestampSec}.`);
  const signedPayload = new Uint8Array(prefix.length + rawBody.length);
  signedPayload.set(prefix, 0);
  signedPayload.set(rawBody, prefix.length);

  const expected = computeSignature(secret, signedPayload);

  for (const sigHex of v1) {
    const got = hexToBuf(sigHex);
    if (!got) continue;

    if (got.length !== expected.length) continue;

    if (timingSafeEqual(got, expected)) {
      return { ok: true };
    }
  }

  return { ok: false, code: "STRIPE_SIGNATURE_INVALID", message: "Invalid Stripe webhook signature." };
};
