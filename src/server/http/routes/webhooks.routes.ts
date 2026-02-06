// src/server/http/routes/webhooks.routes.ts
//
// Webhooks are "transport-only" routes.
// - They must never leak internal errors.
// - They should ACK fast (2xx) when the request is valid.
// - They must be resilient to retries (Stripe will replay).
//
// IMPORTANT (current state):
// This route currently enforces *shape/format* of Stripe's `stripe-signature` header only.
// It does NOT cryptographically verify the signature yet.
// That "real verification" lives in the Billing module workstream and will replace this
// heuristic once the Billing ingestion pipeline is fully wired with its concrete repos.
//
// Why keep this transport-level route for now?
// - Existing CI tests assert this behavior (format + 200 ACK).
// - We don't want billing wiring to destabilize auth/CSRF test suites.
//
// When upgrading to real billing ingestion:
// - Capture raw body bytes (req.arrayBuffer()) BEFORE any parsing.
// - Verify signature using Stripe webhook secret (HMAC SHA256).
// - Only then parse JSON and route to Billing ingestion.
// - Keep responses normalized (AppError/normalizeError/toHttpErrorResponse).

import type { Router } from "../router.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { json } from "../../../shared/http/responses.js";
import { normalizeError } from "../../../shared/errors/normalize-error.js";
import { toHttpErrorResponse } from "../../../shared/errors/http-error-response.js";

/**
 * Parse Stripe signature header into a minimal shape:
 *   "t=...,v1=...,v1=..."
 *
 * We intentionally:
 * - allow extra fields (v0, etc.)
 * - omit `t` entirely if missing (exactOptionalPropertyTypes-safe)
 * - collect ALL v1 values (Stripe may include multiple)
 */
function parseStripeSignatureHeader(sig: string): Readonly<{ t?: string; v1: string[] }> {
  const parts = sig.split(",").map((p) => p.trim()).filter(Boolean);

  let t: string | undefined;
  const v1: string[] = [];

  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx <= 0) continue;

    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();

    if (k === "t" && v) t = v;
    if (k === "v1" && v) v1.push(v);
  }

  // exactOptionalPropertyTypes: omit optional props rather than assigning undefined.
  const out: Readonly<{ t?: string; v1: string[] }> = {
    ...(t !== undefined ? { t } : {}),
    v1,
  };

  return out;
}

/**
 * Stripe v1 signatures are hex HMAC digests.
 * We use a "looks like" check here purely for transport contract tests.
 * NOTE: This is NOT cryptographic verification.
 */
function isHex64(s: string): boolean {
  return /^[0-9a-f]{64}$/i.test(s);
}

/**
 * Register all webhook routes.
 * Webhooks are not a "surface" route; they are provider-to-server callbacks.
 */
export function registerWebhookRoutes(r: Router): void {
  r.post("/webhooks/stripe/billing", async (ctx, req) => {
    try {
      // Stripe sends `stripe-signature`. Without it, we fail the request (400).
      const sig = req.headers.get("stripe-signature");
      if (!sig) {
        throw new AppError({
          code: "INPUT_INVALID",
          status: 400,
          message: "Missing stripe-signature header",
        });
      }

      const parsed = parseStripeSignatureHeader(sig);

      // Require at least one v1 signature, and it must look like a Stripe HMAC hex.
      // This is a transport-level contract check to prevent obviously malformed input.
      if (parsed.v1.length === 0 || !parsed.v1.some(isHex64)) {
        throw new AppError({
          code: "INPUT_INVALID",
          status: 400,
          message: "Invalid stripe-signature header",
          details: { reason: "invalid_signature_format" },
        });
      }

      // TODO (Billing Phase 1):
      // Replace the heuristic above with real Stripe verification:
      // - read raw body bytes: new Uint8Array(await req.arrayBuffer())
      // - compute expected signature using STRIPE_WEBHOOK_SECRET_BILLING
      // - timing-safe compare against v1 signatures
      // - only then parse JSON and pass to billing ingestion pipeline
      //
      // Keep response fast and stable:
      // - return 2xx once verified + event intake claimed idempotently
      // - never throw on duplicates (Stripe retries are normal)

      return json(ctx, { received: true });
    } catch (err) {
      // Always normalize at the transport boundary.
      // No stack traces or implementation details should leak.
      const n = normalizeError(err);
      return toHttpErrorResponse(ctx, n);
    }
  });
}
