import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  timestamp,
  bigint,
  integer,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { accounts } from "./identity";

export const billingCustomers = pgTable(
  "billing_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    accountUnique: uniqueIndex("billing_customers_account_unique").on(t.accountId),
    stripeCustomerUnique: uniqueIndex("billing_customers_stripe_customer_unique").on(t.stripeCustomerId),
  }),
);

export const billingEvents = pgTable(
  "billing_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull(),
    stripeEventId: text("stripe_event_id").notNull(),
    eventType: text("event_type").notNull(),
    livemode: boolean("livemode").notNull(),
    payloadJson: jsonb("payload_json").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),

    processedAt: timestamp("processed_at", { withTimezone: true }),
    processStatus: text("process_status").notNull(),
    failureReason: text("failure_reason"),

    processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
    processingAttempts: integer("processing_attempts").notNull().default(0),
    lastErrorCode: text("last_error_code"),
  },
  (t) => ({
    uniq: uniqueIndex("billing_events_stripe_event_livemode_unique").on(t.stripeEventId, t.livemode),
    statusIdx: index("billing_events_status_received_idx").on(t.processStatus, t.receivedAt),
    stripeIdx: index("billing_events_stripe_event_idx").on(t.stripeEventId, t.livemode),

    statusCheck: check(
      "billing_events_process_status_check",
      sql`${t.processStatus} in ('RECEIVED','PROCESSED','FAILED')`,
    ),
    attemptsCheck: check(
      "billing_events_processing_attempts_check",
      sql`${t.processingAttempts} >= 0`,
    ),
    processedAtCheck: check(
      "billing_events_processed_at_check",
      sql`${t.processedAt} is null or ${t.processedAt} >= ${t.receivedAt}`,
    ),
    startedAtCheck: check(
      "billing_events_processing_started_at_check",
      sql`${t.processingStartedAt} is null or ${t.processingStartedAt} >= ${t.receivedAt}`,
    ),
  }),
);

export const billingTransactions = pgTable(
  "billing_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),

    stripeObjectType: text("stripe_object_type").notNull(),
    stripeObjectId: text("stripe_object_id").notNull(),

    purpose: text("purpose").notNull(),
    kind: text("kind").notNull(),

    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),

    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripeInvoiceId: text("stripe_invoice_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("billing_transactions_object_kind_unique").on(t.stripeObjectType, t.stripeObjectId, t.kind),
    accountOccurredIdx: index("billing_transactions_account_occurred_idx").on(t.accountId, t.occurredAt),
    customerIdx: index("billing_transactions_customer_idx").on(t.stripeCustomerId),
    subscriptionIdx: index("billing_transactions_subscription_idx").on(t.stripeSubscriptionId),

    objectTypeCheck: check(
      "billing_transactions_object_type_check",
      sql`${t.stripeObjectType} in ('checkout_session','invoice','payment_intent','charge','refund')`,
    ),
    purposeCheck: check(
      "billing_transactions_purpose_check",
      sql`${t.purpose} in ('PACK_PURCHASE','SUBSCRIPTION_PAYMENT','CREDITS_TOPUP','OTHER')`,
    ),
    kindCheck: check(
      "billing_transactions_kind_check",
      sql`${t.kind} in ('CHARGE','REFUND','ADJUSTMENT')`,
    ),
    statusCheck: check(
      "billing_transactions_status_check",
      sql`${t.status} in ('SUCCEEDED','PENDING','FAILED')`,
    ),
    amountCheck: check(
      "billing_transactions_amount_check",
      sql`${t.amountCents} >= 0`,
    ),
  }),
);

export const billingLineItems = pgTable(
  "billing_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull(),
    billingTransactionId: uuid("billing_transaction_id")
      .notNull()
      .references(() => billingTransactions.id, { onDelete: "cascade" }),

    lineType: text("line_type").notNull(),
    stripePriceId: text("stripe_price_id"),
    quantity: integer("quantity").notNull().default(1),

    bkReferenceType: text("bk_reference_type").notNull(),
    bkReferenceId: uuid("bk_reference_id").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("billing_line_items_unique").on(
      t.billingTransactionId,
      t.lineType,
      t.bkReferenceType,
      t.bkReferenceId,
    ),
    txIdx: index("billing_line_items_tx_idx").on(t.billingTransactionId),
    bkIdx: index("billing_line_items_bk_ref_idx").on(t.bkReferenceType, t.bkReferenceId),

    lineTypeCheck: check(
      "billing_line_items_line_type_check",
      sql`${t.lineType} in ('PACK','SUBSCRIPTION','CREDITS_TOPUP')`,
    ),
    qtyCheck: check("billing_line_items_quantity_check", sql`${t.quantity} > 0`),
    refTypeCheck: check(
      "billing_line_items_bk_reference_type_check",
      sql`${t.bkReferenceType} in ('PACK_PRODUCT','SUBSCRIPTION_PLAN')`,
    ),
    pairingCheck: check(
      "billing_line_items_type_pairing_check",
      sql`(
        (${t.lineType} = 'PACK' and ${t.bkReferenceType} = 'PACK_PRODUCT')
        or
        (${t.lineType} = 'SUBSCRIPTION' and ${t.bkReferenceType} = 'SUBSCRIPTION_PLAN')
        or
        (${t.lineType} = 'CREDITS_TOPUP' and ${t.bkReferenceType} in ('PACK_PRODUCT','SUBSCRIPTION_PLAN'))
      )`,
    ),
  }),
);

export const billingRefunds = pgTable(
  "billing_refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    billingTransactionId: uuid("billing_transaction_id")
      .notNull()
      .references(() => billingTransactions.id, { onDelete: "cascade" }),

    stripeRefundId: text("stripe_refund_id").notNull(),
    stripeChargeId: text("stripe_charge_id"),

    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull(),
    reason: text("reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    stripeRefundUnique: uniqueIndex("billing_refunds_stripe_refund_unique").on(t.stripeRefundId),
    txRefundUnique: uniqueIndex("billing_refunds_tx_refund_unique").on(t.billingTransactionId, t.stripeRefundId),
    accountCreatedIdx: index("billing_refunds_account_created_idx").on(t.accountId, t.createdAt),
    txIdx: index("billing_refunds_tx_idx").on(t.billingTransactionId),

    amountCheck: check("billing_refunds_amount_check", sql`${t.amountCents} > 0`),
    statusCheck: check(
      "billing_refunds_status_check",
      sql`${t.status} in ('PENDING','SUCCEEDED','FAILED')`,
    ),
  }),
);
