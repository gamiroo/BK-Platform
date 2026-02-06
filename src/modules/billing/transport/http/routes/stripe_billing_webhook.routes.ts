import type { BillingRepoPort } from "../../../application/ports/billing_repo.port.js";

import { mustGetStripeWebhookSecretBilling } from "../../../infrastructure/config/billing_env.js";
import { verifyStripeWebhookSignature } from "../../../infrastructure/stripe/stripe_webhook_verifier.js";
import { handleStripeBillingWebhookHttp } from "../adapters/webhook_http.adapter.js";

export function stripeBillingWebhookRoute(deps: {
  repo: BillingRepoPort;
  env: Record<string, string | undefined>;
}) {
  const secret = mustGetStripeWebhookSecretBilling(deps.env);

  return async function handler(ctx: { request_id?: string }, request: Request): Promise<Response> {
    if (!secret) {
      return new Response(JSON.stringify({ error: "Webhook secret not configured." }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    const signatureHeader = request.headers.get("stripe-signature");
    const rawBody = new Uint8Array(await request.arrayBuffer());

    const args: {
      repo: BillingRepoPort;
      verifier: typeof verifyStripeWebhookSignature;
      secret: string;
      signatureHeader: string | null;
      rawBody: Uint8Array;
      nowMs: number;
      requestId?: string;
    } = {
      repo: deps.repo,
      verifier: verifyStripeWebhookSignature,
      secret,
      signatureHeader,
      rawBody,
      nowMs: Date.now(),
    };

    if (typeof ctx.request_id === "string") args.requestId = ctx.request_id;

    await handleStripeBillingWebhookHttp(args);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}
