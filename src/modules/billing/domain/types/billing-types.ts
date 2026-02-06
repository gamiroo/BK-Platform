import type {
  BillingEventProcessStatus,
  BillingLineType,
  BillingProvider,
  BillingPurpose,
  BillingTransactionKind,
  BillingTransactionStatus,
  BkReferenceType,
} from "./billing-enums.js";

export type BillingEventRow = {
  id: string;
  stripeEventId: string;
  liveMode: boolean;
  type: string;
  receivedAtMs: number;

  processStatus: BillingEventProcessStatus;
  processingStartedAtMs?: number;
  processedAtMs?: number;
  processingAttempts: number;

  failureReason?: string;
  lastErrorCode?: string;

  requestId?: string;

  /**
   * Redacted/minimal payload (never store full raw payload by default).
   */
  payloadJson: unknown;

  /**
   * Hash of raw webhook body for later forensic comparisons without retaining the raw body.
   */
  rawBodySha256Hex?: string;
};

export type BillingTransactionUpsert = {
  provider: BillingProvider;

  stripeObjectType: "invoice" | "charge" | "refund" | "checkout_session" | "payment_intent";
  stripeObjectId: string;

  kind: BillingTransactionKind;
  status: BillingTransactionStatus;
  purpose: BillingPurpose;

  amountCents: number;
  currency: string;
  occurredAtMs: number;

  accountId?: string;
  userId?: string;

  stripeCustomerId?: string;
  stripeInvoiceId?: string;
  stripeSubscriptionId?: string;
  stripeChargeId?: string;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;

  metadata?: Record<string, unknown>;
  requestId?: string;
};

export type BillingTransactionRow = BillingTransactionUpsert & { id: string };

export type BillingLineItemInsert = {
  billingTransactionId: string;
  lineType: BillingLineType;

  bkReferenceType: BkReferenceType;
  bkReferenceId: string;

  quantity: number;
  amountCents?: number;

  metadata?: Record<string, unknown>;
  requestId?: string;
};

export type BillingRefundInsert = {
  stripeRefundId: string;
  stripeChargeId: string;

  billingTransactionId: string;

  amountCents: number;
  currency: string;

  status: "PENDING" | "SUCCEEDED" | "FAILED";
  reason?: string;

  occurredAtMs: number;

  accountId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
};
