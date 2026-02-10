export type BillingProvider = "stripe";

export type BillingEventProcessStatus =
  | "RECEIVED"
  | "PROCESSING"
  | "PROCESSED"
  | "FAILED"
  | "IGNORED";

export type BillingTransactionKind = "CHARGE" | "REFUND";

export type BillingTransactionStatus = "PENDING" | "SUCCEEDED" | "FAILED";

export type BillingPurpose = "PACK_PURCHASE" | "SUBSCRIPTION_PAYMENT" | "OTHER";

export type BillingLineType = "PACK" | "SUBSCRIPTION";

export type BkReferenceType = "PACK_PRODUCT" | "SUBSCRIPTION_PLAN";
