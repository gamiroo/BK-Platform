import test from "node:test";
import assert from "node:assert/strict";

import type { BillingRepoPort } from "@/modules/billing/application/ports/billing_repo.port.js";
import type { StripeWebhookVerifier } from "@/modules/billing/application/ports/stripe.port.js";
import { handleStripeBillingWebhook } from "@/modules/billing/application/use_cases/handle_stripe_billing_webhook.use_case.js";

const okVerifier: StripeWebhookVerifier = () => ({ ok: true });

function makeRepo(): { repo: BillingRepoPort; get: () => { txs: string[]; refunds: string[] } } {
  const txs: string[] = [];
  const refunds: string[] = [];

  const repo: BillingRepoPort = {
    events: {
      async claimEventReceived(input) {
        return {
          claimed: true,
          row: {
            id: "be_1",
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
      async markProcessing() {},
      async markProcessed() {},
      async markFailed() {},
      async markIgnored() {},
    },
    transactions: {
      async upsertByStripeObject(input) {
        txs.push(`${input.stripeObjectType}:${input.stripeObjectId}:${input.kind}:${input.status}`);
        return { id: `tx_${txs.length}`, ...input };
      },
      async findChargeTransactionByStripeChargeId(chargeId) {
        // return a fake existing charge tx if asked
        if (chargeId === "ch_1") {
          return {
            id: "tx_charge",
            provider: "stripe",
            stripeObjectType: "charge",
            stripeObjectId: "ch_1",
            kind: "CHARGE",
            status: "SUCCEEDED",
            purpose: "PACK_PURCHASE",
            amountCents: 2500,
            currency: "aud",
            occurredAtMs: 100000,
            stripeChargeId: "ch_1",
          };
        }
        return null;
      },
    },
    lineItems: {
      async insertMany() {},
    },
    refunds: {
      async insert(input) {
        refunds.push(`${input.stripeRefundId}:${input.status}`);
      },
    },
  };

  return { repo, get: () => ({ txs, refunds }) };
}

test("charge.succeeded creates CHARGE transaction", async () => {
  const { repo, get } = makeRepo();

  const event = {
    id: "evt_charge",
    type: "charge.succeeded",
    created: 100,
    livemode: false,
    data: { object: { id: "ch_99", amount: 2500, currency: "aud", created: 100 } },
  };

  await handleStripeBillingWebhook({
    verifier: okVerifier,
    repo,
    secret: "whsec_test",
    signatureHeader: "t=1,v1=abc",
    rawBody: new TextEncoder().encode(JSON.stringify(event)),
    nowMs: 1700000000000,
  });

  const { txs } = get();
  assert.ok(txs.some((t) => t.startsWith("charge:ch_99:CHARGE:SUCCEEDED")));
});

test("refund.created inserts refund when correlated to charge", async () => {
  const { repo, get } = makeRepo();

  const event = {
    id: "evt_refund",
    type: "refund.created",
    created: 101,
    livemode: false,
    data: {
      object: {
        id: "re_1",
        amount: 2500,
        currency: "aud",
        charge: "ch_1",
        status: "succeeded",
        created: 101,
      },
    },
  };

  await handleStripeBillingWebhook({
    verifier: okVerifier,
    repo,
    secret: "whsec_test",
    signatureHeader: "t=1,v1=abc",
    rawBody: new TextEncoder().encode(JSON.stringify(event)),
    nowMs: 1700000000000,
  });

  const { refunds } = get();
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0], "re_1:SUCCEEDED");
});
