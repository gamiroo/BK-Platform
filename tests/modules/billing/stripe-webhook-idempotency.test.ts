import test from "node:test";
import assert from "node:assert/strict";

import type { BillingRepoPort } from "../../../src/modules/billing/application/ports/billing_repo.port.js";
import type { StripeWebhookVerifier } from "../../../src/modules/billing/application/ports/stripe.port.js";
import { handleStripeBillingWebhook } from "../../../src/modules/billing/application/use_cases/handle_stripe_billing_webhook.use_case.js";

const okVerifier: StripeWebhookVerifier = () => ({ ok: true });

function makeInMemoryRepo(): { repo: BillingRepoPort; counts: () => { events: number } } {
  const events = new Map<string, { id: string }>();

  const repo: BillingRepoPort = {
    events: {
      async claimEventReceived(
        input: Parameters<BillingRepoPort["events"]["claimEventReceived"]>[0]
      ) {
        const key = `${input.stripeEventId}:${String(input.liveMode)}`;
        const existing = events.get(key);

        if (existing) {
          return {
            claimed: false,
            row: {
              id: existing.id,
              stripeEventId: input.stripeEventId,
              liveMode: input.liveMode,
              type: input.type,
              receivedAtMs: input.receivedAtMs,
              processStatus: "RECEIVED",
              processingAttempts: 0,
              payloadJson: input.payloadJson,
            },
          };
        }

        const id = `be_${events.size + 1}`;
        events.set(key, { id });

        return {
          claimed: true,
          row: {
            id,
            stripeEventId: input.stripeEventId,
            liveMode: input.liveMode,
            type: input.type,
            receivedAtMs: input.receivedAtMs,
            processStatus: "RECEIVED",
            processingAttempts: 0,
            payloadJson: input.payloadJson,
          },
        };
      },

      async markProcessing(_input) {},
      async markProcessed(_input) {},
      async markFailed(_input) {},
      async markIgnored(_input) {},
    },

    transactions: {
      async upsertByStripeObject(
        input: Parameters<BillingRepoPort["transactions"]["upsertByStripeObject"]>[0]
      ) {
        return { id: "tx_1", ...input };
      },

      async findChargeTransactionByStripeChargeId(_stripeChargeId) {
        return null;
      },
    },

    lineItems: {
      async insertMany(_items) {},
    },

    refunds: {
      async insert(_input) {},
    },
  };

  return { repo, counts: () => ({ events: events.size }) };
}

test("billing_events is idempotent on (stripe_event_id, livemode)", async () => {
  const { repo, counts } = makeInMemoryRepo();

  const event = {
    id: "evt_1",
    type: "charge.succeeded",
    created: 100,
    livemode: false,
    data: { object: { id: "ch_1", amount: 100, currency: "aud", created: 100 } },
  };

  const rawBody = new TextEncoder().encode(JSON.stringify(event));

  const first = await handleStripeBillingWebhook({
    verifier: okVerifier,
    repo,
    secret: "whsec_test",
    signatureHeader: "t=1,v1=abc",
    rawBody,
    nowMs: 1700000000000,
  });

  const second = await handleStripeBillingWebhook({
    verifier: okVerifier,
    repo,
    secret: "whsec_test",
    signatureHeader: "t=1,v1=abc",
    rawBody,
    nowMs: 1700000000000,
  });

  assert.equal(first.received, true);
  assert.equal(second.deduped, true);
  assert.equal(counts().events, 1);
});
