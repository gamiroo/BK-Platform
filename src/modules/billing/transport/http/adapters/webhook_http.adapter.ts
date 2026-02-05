import type { BillingRepoPort } from "../../../application/ports/billing_repo.port.js";
import type { StripeWebhookVerifier } from "../../../application/ports/stripe.port.js";

import { handleStripeBillingWebhook } from "../../../application/use_cases/handle_stripe_billing_webhook.use_case.js";

export async function handleStripeBillingWebhookHttp(args: {
  repo: BillingRepoPort;
  verifier: StripeWebhookVerifier;
  secret: string;
  signatureHeader: string | null;
  rawBody: Uint8Array;
  nowMs: number;
  requestId?: string;
}): Promise<{ received: true }> {
  const payload: {
    verifier: StripeWebhookVerifier;
    repo: BillingRepoPort;
    secret: string;
    signatureHeader: string | null;
    rawBody: Uint8Array;
    nowMs: number;
    requestId?: string;
  } = {
    verifier: args.verifier,
    repo: args.repo,
    secret: args.secret,
    signatureHeader: args.signatureHeader,
    rawBody: args.rawBody,
    nowMs: args.nowMs,
  };

  if (typeof args.requestId === "string") payload.requestId = args.requestId;

  await handleStripeBillingWebhook(payload);
  return { received: true };
}
