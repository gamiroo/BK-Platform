import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  timestamp,
  integer,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { accounts, users } from "./identity"; // adjust to your actual exports
import { billingEvents, billingTransactions } from "./billing";

export const subscriptionPlans = pgTable(
  "subscription_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerPlanId: text("provider_plan_id").notNull(),
    currency: text("currency").notNull().default("AUD"),
    provider: text("provider").notNull().default("stripe"),
    key: text("key").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    providerPlanUnique: uniqueIndex("subscription_plans_provider_plan_unique").on(t.providerPlanId),
    keyUnique: uniqueIndex("subscription_plans_key_unique").on(t.key),
    statusCheck: check("subscription_plans_status_check", sql`${t.status} in ('ACTIVE','RETIRED')`),
  }),
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    planId: uuid("plan_id").notNull().references(() => subscriptionPlans.id),

    provider: text("provider").notNull().default("stripe"),
    providerSubscriptionId: text("provider_subscription_id"),
    providerCustomerId: text("provider_customer_id"),

    status: text("status").notNull(),

    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),

    autoPauseOnPackZero: boolean("auto_pause_on_pack_zero").notNull().default(true),

    pausedAt: timestamp("paused_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    resumeAt: timestamp("resume_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    providerSubUnique: uniqueIndex("subscriptions_provider_subscription_unique").on(t.providerSubscriptionId),
    accountStatusIdx: index("subscriptions_account_status_idx").on(t.accountId, t.status),

    statusCheck: check(
      "subscriptions_status_check",
      sql`${t.status} in ('INCOMPLETE','ACTIVE','PAST_DUE','PAUSED','CANCELLED')`,
    ),
    periodsRequiredCheck: check(
      "subscriptions_periods_required_check",
      sql`(${t.status} not in ('ACTIVE','PAST_DUE','PAUSED'))
          or (${t.currentPeriodStart} is not null and ${t.currentPeriodEnd} is not null)`,
    ),
    resumeOnlyWhenPausedCheck: check(
      "subscriptions_resume_only_when_paused_check",
      sql`${t.resumeAt} is null or ${t.status} = 'PAUSED'`,
    ),
    cancelAtPeriodEndCancelledCheck: check(
      "subscriptions_cancel_at_period_end_cancelled_check",
      sql`${t.status} != 'CANCELLED' or ${t.cancelAtPeriodEnd} = false`,
    ),
  }),
);

/**
 * IMPORTANT:
 * The "one live subscription per account" partial unique index
 * is created in SQL migration (CREATE UNIQUE INDEX ... WHERE ...).
 * Keep it in migration; Drizzle TS doesn't model partial unique indexes cleanly.
 */

export const subscriptionEntitlements = pgTable(
  "subscription_entitlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    subscriptionId: uuid("subscription_id").notNull().references(() => subscriptions.id),

    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),

    presetAccess: boolean("preset_access").notNull().default(false),
    overrideAccess: boolean("override_access").notNull().default(false),
    overrideAllowance: integer("override_allowance").notNull().default(0),
    overrideUsed: integer("override_used").notNull().default(0),
    promoUnlockedCreditsGrant: integer("promo_unlocked_credits_grant").notNull().default(0),

    eventType: text("event_type").notNull(),
    actorType: text("actor_type").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id),

    metadataJson: jsonb("metadata_json"),

    billingTransactionId: uuid("billing_transaction_id").references(() => billingTransactions.id),

    idempotencyKey: text("idempotency_key").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniquePeriod: uniqueIndex("subscription_entitlements_unique_period").on(t.subscriptionId, t.periodStart),
    idempotencyUnique: uniqueIndex("subscription_entitlements_idempotency_unique").on(t.accountId, t.idempotencyKey),

    subPeriodIdx: index("subscription_entitlements_sub_period_idx").on(t.subscriptionId, t.periodStart),
    subCreatedIdx: index("subscription_entitlements_sub_created_idx").on(t.subscriptionId, t.createdAt),
    accountCreatedIdx: index("subscription_entitlements_account_created_idx").on(t.accountId, t.createdAt),

    periodCheck: check("subscription_entitlements_period_check", sql`${t.periodEnd} > ${t.periodStart}`),
    overrideCheck: check("subscription_entitlements_override_check", sql`${t.overrideUsed} <= ${t.overrideAllowance}`),
  }),
);

export const subscriptionEvents = pgTable(
  "subscription_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    subscriptionId: uuid("subscription_id").notNull().references(() => subscriptions.id),

    billingEventId: uuid("billing_event_id").references(() => billingEvents.id),
    billingTransactionId: uuid("billing_transaction_id").references(() => billingTransactions.id),

    eventType: text("event_type").notNull(),
    actorType: text("actor_type").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id),

    idempotencyKey: text("idempotency_key").notNull(),
    metadataJson: jsonb("metadata_json"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idempotencyUnique: uniqueIndex("subscription_events_idempotency_unique").on(t.accountId, t.idempotencyKey),

    subCreatedIdx: index("subscription_events_sub_created_idx").on(t.subscriptionId, t.createdAt),
    accountCreatedIdx: index("subscription_events_account_created_idx").on(t.accountId, t.createdAt),
    billingEventIdx: index("subscription_events_billing_event_idx").on(t.billingEventId),
    billingTxIdx: index("subscription_events_billing_tx_idx").on(t.billingTransactionId),

    eventTypeCheck: check(
      "subscription_events_event_type_check",
      sql`${t.eventType} in (
        'SUBSCRIPTION_CREATED',
        'SUBSCRIPTION_CHECKOUT_STARTED',
        'SUBSCRIPTION_CHECKOUT_COMPLETED',
        'SUBSCRIPTION_INVOICE_PAID',
        'SUBSCRIPTION_INVOICE_PAYMENT_FAILED',
        'SUBSCRIPTION_PAUSED',
        'SUBSCRIPTION_RESUMED',
        'SUBSCRIPTION_CANCEL_REQUESTED',
        'SUBSCRIPTION_CANCELLED',
        'SUBSCRIPTION_PROVIDER_UPDATED',
        'SUBSCRIPTION_ENTITLEMENTS_GRANTED'
      )`,
    ),
    billingLinkCheck: check(
      "subscription_events_billing_link_check",
      sql`${t.billingEventId} is null or ${t.billingTransactionId} is not null`,
    ),
  }),
);
