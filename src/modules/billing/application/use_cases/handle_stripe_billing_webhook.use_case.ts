import { createHash } from "node:crypto";

import type { BillingRepoPort } from "../ports/billing_repo.port.js";
import type { StripeWebhookVerifier } from "../ports/stripe.port.js";
import type { StripeEvent } from "../../domain/types/stripe-types.js";

import { STRIPE_BILLING_EVENT_ALLOWLIST } from "../../domain/policies/stripe_event_allowlist.js";
import { redactStripeEventForStorage } from "../../domain/policies/payload_retention_policy.js";
import { BillingError } from "../../domain/errors/billing-errors.js";
import { withBillingEventProcessing } from "../services/event_processing.service.js";

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function parseStripeEventJson(rawBody: Uint8Array): StripeEvent {
  let parsed: unknown;
  try {
    const text = new TextDecoder().decode(rawBody);
    parsed = JSON.parse(text);
  } catch {
    throw new BillingError({
      code: "STRIPE_EVENT_JSON_INVALID",
      status: 400,
      message: "Invalid Stripe event JSON.",
    });
  }

  if (!isRecord(parsed)) {
    throw new BillingError({
      code: "STRIPE_EVENT_JSON_INVALID",
      status: 400,
      message: "Invalid Stripe event JSON.",
    });
  }

  const id = parsed["id"];
  const type = parsed["type"];
  const created = parsed["created"];
  const livemode = parsed["livemode"];
  const data = parsed["data"];

  if (
    typeof id !== "string" ||
    typeof type !== "string" ||
    typeof created !== "number" ||
    typeof livemode !== "boolean" ||
    !isRecord(data) ||
    !isRecord(data["object"])
  ) {
    throw new BillingError({
      code: "STRIPE_EVENT_JSON_INVALID",
      status: 400,
      message: "Invalid Stripe event JSON.",
    });
  }

  const api_version = typeof parsed["api_version"] === "string" ? parsed["api_version"] : undefined;

  const ev: StripeEvent = {
    id,
    type,
    created,
    livemode,
    data: { object: data["object"] as Record<string, unknown> },
  };
  if (api_version) ev.api_version = api_version;

  return ev;
}

function maybeAdd<T extends Record<string, unknown>, K extends string>(
  obj: T,
  key: K,
  value: string | undefined
): T & Partial<Record<K, string>> {
  if (typeof value === "string") {
    return { ...obj, [key]: value } as T & Partial<Record<K, string>>;
  }
  return obj as T & Partial<Record<K, string>>;
}

function getMetadata(obj: Record<string, unknown>): Record<string, unknown> | undefined {
  const m = obj["metadata"];
  return isRecord(m) ? m : undefined;
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

function getNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export async function handleStripeBillingWebhook(args: {
  verifier: StripeWebhookVerifier;
  repo: BillingRepoPort;
  secret: string;
  signatureHeader: string | null;
  rawBody: Uint8Array;
  requestId?: string;
  nowMs: number;
  toleranceSec?: number;
}): Promise<{ received: true; deduped: boolean; processed: boolean; ignored: boolean; eventType: string }> {
  const toleranceSec = args.toleranceSec ?? 300;

  if (!args.secret) {
    throw new BillingError({
      code: "STRIPE_WEBHOOK_SECRET_MISSING",
      status: 500,
      message: "Webhook secret is not configured.",
    });
  }

  const verified = args.verifier({
    rawBody: args.rawBody,
    signatureHeader: args.signatureHeader,
    secret: args.secret,
    nowMs: args.nowMs,
    toleranceSec,
  });

   if (!verified.ok) {
    const base = {
      code: verified.code,
      status: 400,
      message: verified.message,
    } as const;

    throw new BillingError(verified.details ? { ...base, details: verified.details } : base);
  }

  const event = parseStripeEventJson(args.rawBody);
  const payloadJson = redactStripeEventForStorage(event);

  const claimPayload: {
    stripeEventId: string;
    liveMode: boolean;
    type: string;
    receivedAtMs: number;
    payloadJson: unknown;
    rawBodySha256Hex: string;
    requestId?: string;
  } = {
    stripeEventId: event.id,
    liveMode: event.livemode,
    type: event.type,
    receivedAtMs: args.nowMs,
    payloadJson,
    rawBodySha256Hex: sha256Hex(args.rawBody),
  };
  if (typeof args.requestId === "string") claimPayload.requestId = args.requestId;

  const claimed = await args.repo.events.claimEventReceived(claimPayload);

  if (!claimed.claimed) {
    return { received: true, deduped: true, processed: false, ignored: false, eventType: event.type };
  }

  const billingEventId = claimed.row.id;

  if (!STRIPE_BILLING_EVENT_ALLOWLIST.has(event.type)) {
    await args.repo.events.markIgnored({ id: billingEventId, nowMs: args.nowMs, reason: "event_not_allowlisted" });
    return { received: true, deduped: false, processed: false, ignored: true, eventType: event.type };
  }

  await withBillingEventProcessing({
    repo: args.repo,
    billingEventId,
    nowMs: args.nowMs,
    work: async () => {
      switch (event.type) {
        case "charge.succeeded":
          await handleChargeSucceeded({
            repo: args.repo,
            event,
            nowMs: args.nowMs,
            ...(typeof args.requestId === "string" ? { requestId: args.requestId } : {}),
          });
          return;

        case "refund.created":
          await handleRefundCreated({
            repo: args.repo,
            event,
            nowMs: args.nowMs,
            ...(typeof args.requestId === "string" ? { requestId: args.requestId } : {}),
          });
          return;

        case "invoice.payment_succeeded":
          await handleInvoicePaymentSucceeded({
            repo: args.repo,
            event,
            nowMs: args.nowMs,
            ...(typeof args.requestId === "string" ? { requestId: args.requestId } : {}),
          });
          return;

        default:
          return;
      }
    },
  });

  return { received: true, deduped: false, processed: true, ignored: false, eventType: event.type };
}

async function handleChargeSucceeded(args: {
  repo: BillingRepoPort;
  event: StripeEvent;
  nowMs: number;
  requestId?: string;
}): Promise<void> {
  const charge = args.event.data.object;

  const chargeId = getString(charge, "id");
  const amount = getNumber(charge, "amount");
  const currency = getString(charge, "currency");

  if (!chargeId || amount === undefined || !currency) return;

  const createdSec = getNumber(charge, "created");
  const occurredAtMs = createdSec !== undefined ? createdSec * 1000 : args.nowMs;

  const metadata = getMetadata(charge);
  const bkAccountId = metadata && typeof metadata["bk_account_id"] === "string" ? metadata["bk_account_id"] : undefined;
  const purchaseType = metadata && typeof metadata["bk_purchase_type"] === "string" ? metadata["bk_purchase_type"] : undefined;

  const baseTx = {
    provider: "stripe" as const,
    stripeObjectType: "charge" as const,
    stripeObjectId: chargeId,
    kind: "CHARGE" as const,
    status: "SUCCEEDED" as const,
    purpose: purchaseType === "PACK_PURCHASE" ? ("PACK_PURCHASE" as const) : ("OTHER" as const),
    amountCents: amount,
    currency,
    occurredAtMs,
  };

  let txPayload: typeof baseTx & {
    accountId?: string;
    stripeCustomerId?: string;
    stripeInvoiceId?: string;
    stripeSubscriptionId?: string;
    stripePaymentIntentId?: string;
    stripeChargeId?: string;
    metadata?: Record<string, unknown>;
    requestId?: string;
  } = { ...baseTx };

  if (bkAccountId) txPayload = { ...txPayload, accountId: bkAccountId };

  txPayload = maybeAdd(txPayload, "stripeCustomerId", getString(charge, "customer"));
  txPayload = maybeAdd(txPayload, "stripeInvoiceId", getString(charge, "invoice"));
  txPayload = maybeAdd(txPayload, "stripeSubscriptionId", getString(charge, "subscription"));
  txPayload = maybeAdd(txPayload, "stripePaymentIntentId", getString(charge, "payment_intent"));
  txPayload = { ...txPayload, stripeChargeId: chargeId };

  if (metadata) txPayload = { ...txPayload, metadata: { ...metadata } };
  if (typeof args.requestId === "string") txPayload = { ...txPayload, requestId: args.requestId };

  const tx = await args.repo.transactions.upsertByStripeObject(txPayload);

  const packProductId =
    metadata && typeof metadata["bk_pack_product_id"] === "string" ? metadata["bk_pack_product_id"] : undefined;

  if (packProductId) {
    const li: {
      billingTransactionId: string;
      lineType: "PACK";
      bkReferenceType: "PACK_PRODUCT";
      bkReferenceId: string;
      quantity: number;
      requestId?: string;
    } = {
      billingTransactionId: tx.id,
      lineType: "PACK",
      bkReferenceType: "PACK_PRODUCT",
      bkReferenceId: packProductId,
      quantity: 1,
    };

    if (typeof args.requestId === "string") li.requestId = args.requestId;

    await args.repo.lineItems.insertMany([li]);
  }
}

async function handleRefundCreated(args: {
  repo: BillingRepoPort;
  event: StripeEvent;
  nowMs: number;
  requestId?: string;
}): Promise<void> {
  const refund = args.event.data.object;

  const refundId = getString(refund, "id");
  const chargeId = getString(refund, "charge");
  const amount = getNumber(refund, "amount");
  const currency = getString(refund, "currency");
  const statusRaw = getString(refund, "status");

  if (!refundId || !chargeId || amount === undefined || amount <= 0 || !currency) return;

  const chargeTx = await args.repo.transactions.findChargeTransactionByStripeChargeId(chargeId);
  if (!chargeTx) return;

  const createdSec = getNumber(refund, "created");
  const occurredAtMs = createdSec !== undefined ? createdSec * 1000 : args.nowMs;

  const reason = getString(refund, "reason");

  const status =
    statusRaw === "succeeded" ? "SUCCEEDED" : statusRaw === "failed" ? "FAILED" : "PENDING";

  // Refund record (must be linked to the originating transaction)
  const refundInsert: {
    stripeRefundId: string;
    stripeChargeId: string;
    billingTransactionId: string;
    amountCents: number;
    currency: string;
    status: "PENDING" | "SUCCEEDED" | "FAILED";
    occurredAtMs: number;
    reason?: string;
    accountId?: string;
    requestId?: string;
  } = {
    stripeRefundId: refundId,
    stripeChargeId: chargeId,
    billingTransactionId: chargeTx.id,
    amountCents: amount,
    currency,
    status,
    occurredAtMs,
  };

  if (reason) refundInsert.reason = reason;
  if (chargeTx.accountId) refundInsert.accountId = chargeTx.accountId;
  if (typeof args.requestId === "string") refundInsert.requestId = args.requestId;

  await args.repo.refunds.insert(refundInsert);

  // Optional: refund transaction row (idempotent by stripe object key)
  const baseRefundTx = {
    provider: "stripe" as const,
    stripeObjectType: "refund" as const,
    stripeObjectId: refundId,
    kind: "REFUND" as const,
    status: status === "SUCCEEDED" ? ("SUCCEEDED" as const) : status === "FAILED" ? ("FAILED" as const) : ("PENDING" as const),
    purpose: chargeTx.purpose,
    amountCents: amount,
    currency,
    occurredAtMs,
    stripeChargeId: chargeId,
  };

  let refundTxPayload: typeof baseRefundTx & { accountId?: string; requestId?: string } = { ...baseRefundTx };
  if (chargeTx.accountId) refundTxPayload = { ...refundTxPayload, accountId: chargeTx.accountId };
  if (typeof args.requestId === "string") refundTxPayload = { ...refundTxPayload, requestId: args.requestId };

  await args.repo.transactions.upsertByStripeObject(refundTxPayload);
}

async function handleInvoicePaymentSucceeded(args: {
  repo: BillingRepoPort;
  event: StripeEvent;
  nowMs: number;
  requestId?: string;
}): Promise<void> {
  const invoice = args.event.data.object;

  const invoiceId = getString(invoice, "id");
  const amountPaid = getNumber(invoice, "amount_paid");
  const currency = getString(invoice, "currency");

  if (!invoiceId || amountPaid === undefined || !currency) return;

  const stripeCustomerId = getString(invoice, "customer");
  const stripeSubscriptionId = getString(invoice, "subscription");

  const transitionsRaw = invoice["status_transitions"];
  const transitions = isRecord(transitionsRaw) ? transitionsRaw : undefined;
  const paidAtSec = transitions ? getNumber(transitions, "paid_at") : undefined;
  const occurredAtMs = paidAtSec !== undefined ? paidAtSec * 1000 : args.nowMs;

  const metadata = getMetadata(invoice);
  const bkAccountId = metadata && typeof metadata["bk_account_id"] === "string" ? metadata["bk_account_id"] : undefined;

  const baseTx = {
    provider: "stripe" as const,
    stripeObjectType: "invoice" as const,
    stripeObjectId: invoiceId,
    kind: "CHARGE" as const,
    status: "SUCCEEDED" as const,
    purpose: "SUBSCRIPTION_PAYMENT" as const,
    amountCents: amountPaid,
    currency,
    occurredAtMs,
    stripeInvoiceId: invoiceId,
  };

  let txPayload: typeof baseTx & {
    accountId?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    metadata?: Record<string, unknown>;
    requestId?: string;
  } = { ...baseTx };

  if (bkAccountId) txPayload = { ...txPayload, accountId: bkAccountId };
  txPayload = maybeAdd(txPayload, "stripeCustomerId", stripeCustomerId);
  txPayload = maybeAdd(txPayload, "stripeSubscriptionId", stripeSubscriptionId);
  if (metadata) txPayload = { ...txPayload, metadata: { ...metadata } };
  if (typeof args.requestId === "string") txPayload = { ...txPayload, requestId: args.requestId };

  const tx = await args.repo.transactions.upsertByStripeObject(txPayload);

  const bkPlanId =
    metadata && typeof metadata["bk_subscription_plan_id"] === "string" ? metadata["bk_subscription_plan_id"] : undefined;

  if (bkPlanId) {
    const li: {
      billingTransactionId: string;
      lineType: "SUBSCRIPTION";
      bkReferenceType: "SUBSCRIPTION_PLAN";
      bkReferenceId: string;
      quantity: number;
      requestId?: string;
    } = {
      billingTransactionId: tx.id,
      lineType: "SUBSCRIPTION",
      bkReferenceType: "SUBSCRIPTION_PLAN",
      bkReferenceId: bkPlanId,
      quantity: 1,
    };
    if (typeof args.requestId === "string") li.requestId = args.requestId;

    await args.repo.lineItems.insertMany([li]);
  }
}
