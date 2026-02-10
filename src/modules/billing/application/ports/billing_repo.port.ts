import type {
  BillingEventRow,
  BillingLineItemInsert,
  BillingRefundInsert,
  BillingTransactionRow,
  BillingTransactionUpsert,
} from "../../domain/types/billing-types.js";

export type BillingEventsRepo = {
  claimEventReceived(input: {
    stripeEventId: string;
    liveMode: boolean;
    type: string;
    receivedAtMs: number;
    payloadJson: unknown;
    rawBodySha256Hex?: string;
    requestId?: string;
  }): Promise<{ claimed: boolean; row: BillingEventRow }>;

  markProcessing(input: { id: string; nowMs: number }): Promise<void>;
  markProcessed(input: { id: string; nowMs: number }): Promise<void>;

  markFailed(input: { id: string; nowMs: number; failureReason: string; lastErrorCode?: string }): Promise<void>;
  markIgnored(input: { id: string; nowMs: number; reason: string }): Promise<void>;
};

export type BillingTransactionsRepo = {
  upsertByStripeObject(input: BillingTransactionUpsert): Promise<BillingTransactionRow>;
  findChargeTransactionByStripeChargeId(stripeChargeId: string): Promise<BillingTransactionRow | null>;
};

export type BillingLineItemsRepo = {
  insertMany(items: BillingLineItemInsert[]): Promise<void>;
};

export type BillingRefundsRepo = {
  insert(input: BillingRefundInsert): Promise<void>;
};

export type BillingRepoPort = {
  events: BillingEventsRepo;
  transactions: BillingTransactionsRepo;
  lineItems: BillingLineItemsRepo;
  refunds: BillingRefundsRepo;
};
