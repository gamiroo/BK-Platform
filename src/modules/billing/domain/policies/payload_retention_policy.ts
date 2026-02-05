import type { StripeEvent } from "../types/stripe-types.js";

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function pick(src: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k];
  }
  return out;
}

/**
 * Store only the minimal subset of Stripe payload needed for audit + reconciliation.
 */
export function redactStripeEventForStorage(event: StripeEvent): Record<string, unknown> {
  const obj = event.data?.object ?? {};

  const common = pick(obj, [
    "id",
    "object",
    "amount",
    "amount_captured",
    "amount_due",
    "amount_paid",
    "currency",
    "status",
    "created",
    "customer",
    "subscription",
    "invoice",
    "payment_intent",
    "charge",
    "mode",
    "client_reference_id",
    "lines",
    "status_transitions",
    "pause_collection",
    "cancel_at_period_end",
    "canceled_at",
    "current_period_start",
    "current_period_end",
  ]);

  const metadataRaw = obj["metadata"];
  const metadata = isRecord(metadataRaw)
    ? pick(metadataRaw, [
        "bk_account_id",
        "bk_purchase_type",
        "bk_pack_product_id",
        "bk_subscription_plan_key",
        "bk_subscription_plan_id",
      ])
    : undefined;

  const safeObject: Record<string, unknown> = metadata
    ? { ...common, metadata }
    : common;

  return {
    id: event.id,
    type: event.type,
    created: event.created,
    livemode: event.livemode,
    api_version: event.api_version,
    data: { object: safeObject },
  };
}
