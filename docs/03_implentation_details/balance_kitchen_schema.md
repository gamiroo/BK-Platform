# balance_kitchen_schema.md — Canonical Database Specification (v1.0)

> **Authoritative database schema document** for the Balance Kitchen (BK) platform.
>
> This document defines the **production-ready PostgreSQL schema** for BK.
> It is the source of truth for tables, columns, constraints, indexes, and invariants.
>
> The schema is designed to align with:
>
> - `balance.md`
> - `balance_kitchen_business_model.md`
> - `balance_kitchen_architecture.md`
> - `balanceguard.md`
> - `ordering_module.md`
> - `credits_module.md`
> - `reward_shop_module.md`
> - `operational_failure_model.md`
>
> **If code and schema docs disagree, the schema docs win.**

---

## 0. Status & Versioning

**Status:** Proposed (v1.0)

**Database:** PostgreSQL

**ORM:** Drizzle (explicit SQL allowed)

**General policy:**

- Prefer **UUID primary keys** (`uuid`) for public-facing entities
- Prefer **ULID** only if strictly needed for ordering by time; otherwise UUID
- Use **immutable append-only ledgers** for financial/entitlement facts
- Use **FK constraints** for integrity; do not rely on application code alone

---

## 1. Global Conventions (Mandatory)

### 1.1 Core Columns

Most tables MUST include:

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Tables that require soft delete MUST include:

- `deleted_at timestamptz null`

### 1.2 Request Correlation

Tables that store actions or events SHOULD store:

- `request_id uuid not null`

`request_id` correlates the write to BalanceGuard request context.

### 1.2.1 Idempotency Keys (Mandatory for Economic Writes)

Any write that represents an economic fact MUST be idempotent at the database layer.

Required pattern:

- Store an `idempotency_key text not null` on the write table (or event table)
- Enforce uniqueness with a constraint scoped to the account:
  - unique (`account_id`, `idempotency_key`)

Applies to:

- credit consumption / grants / reversals
- reward shop purchases and redemptions
- order confirmation and cancellation transitions
- checkout creation attempts (optional but recommended)

Rationale:
Prevents double-spend and duplicate side-effects on retries, webhook replays, and race conditions.

### 1.3 Actor Attribution

Tables representing actions SHOULD store:

- `actor_type text not null` (e.g., `system`, `admin`, `account_manager`, `client`)
- `actor_user_id uuid null` (nullable for system)

### 1.4 Money

- Use `amount_cents bigint not null` and `currency text not null` (ISO 4217)
- Never use floating point for money

### 1.5 Enumerations

Use `text` columns with CHECK constraints for enums (portable and Drizzle-friendly).

### 1.6 Environment Marker (Operational Safety)

BK uses a single-row environment marker table to reduce the risk of “wrong DB” incidents
(e.g., accidentally running migrations or seed scripts against production).

This table is written by controlled scripts only (e.g., during provisioning or CI),
and can be checked by “DB safety” tooling before destructive operations.

#### bk_env_marker

Columns:

- `id int primary key` (always `1`)
- `env text not null` (e.g., `development`, `test`, `production`)
- `updated_at timestamptz not null default now()`

Notes:

- Treat this as an **operational guardrail**, not an auth/security primitive.
- Your DB safety checks MAY enforce:
  - “production DB must have env='production'”
  - “non-prod must never have env='production'”

---

## 2. Identity & Access Control

### 2.1 users

Represents a person who can authenticate.

Columns:

- `id uuid pk`
- `email text not null unique`
- `email_verified_at timestamptz null`
- `display_name text null`

- `password_hash text null`
  - Nullable to allow future flows (invite-only, magic link, OAuth) where a local password may not exist yet.
  - If present, it MUST store a PHC-formatted Argon2id hash string (see below).

- `status text not null` CHECK IN (`ACTIVE`,`SUSPENDED`,`DELETED`)
- `created_at`, `updated_at`, `deleted_at`

Indexes:

- unique index on `lower(email)`

Password hashing:

- Algorithm: **Argon2id**
- Storage format: store the **full PHC string** produced by the hashing library in `users.password_hash`
  (e.g., `$argon2id$v=19$m=...,t=...,p=...$salt$hash`).
- Application rules:
  - Never store plaintext passwords.
  - Verification uses the stored PHC hash as the source of truth.
  - Support “needs rehash” upgrades when parameters are raised over time.

---

### 2.2 accounts

Represents an owned customer account context.

Columns:

- `id uuid pk`
- `account_type text not null` CHECK IN (`CUSTOMER`,`INTERNAL`)
- `status text not null` CHECK IN (`ACTIVE`,`PAUSED`,`SUSPENDED`,`CLOSED`)
- `primary_user_id uuid not null fk users(id)`
- `created_at`, `updated_at`, `deleted_at`

Indexes:

- index on `primary_user_id`

---

### 2.3 roles

Columns:

- `id uuid pk`
- `key text not null unique` (e.g., `client`, `admin`, `account_manager`, `super_admin`)
- `description text null`
- `created_at`, `updated_at`

---

### 2.4 account_memberships

Maps users to accounts with roles.

Columns:

- `id uuid pk`
- `account_id uuid not null fk accounts(id)`
- `user_id uuid not null fk users(id)`
- `role_key text not null` CHECK IN (`client`,`admin`,`account_manager`,`super_admin`)
- `created_at`, `updated_at`, `deleted_at`

Constraints:

- unique (`account_id`,`user_id`,`role_key`) where `deleted_at is null`

Indexes:

- index on `user_id`
- index on `account_id`

---

## 3. Sessions (BalanceGuard v3)

### 3.1 sessions

Opaque server-side session records.

Columns:

- `id uuid pk` (session_id)
- `user_id uuid not null fk users(id)`
- `surface text not null` CHECK IN (`client`,`admin`)
- `auth_level text not null` CHECK IN (`AAL1`,`AAL2`,`AAL3`)
- `session_family_id uuid not null`
- `rotation_counter int not null default 0`
- `created_at timestamptz not null default now()`
- `last_seen_at timestamptz not null default now()`
- `expires_at timestamptz not null`
- `revoked_at timestamptz null`
- `revoke_reason text null`
- `user_agent_snapshot text null`
- `device_id_hash text null`
- `ip_created inet null`

Constraints:

- `revoked_at is null OR revoked_at <= now()` (informational)

Indexes:

- index on (`user_id`,`surface`,`revoked_at`)
- index on `expires_at`

---

## 4. Enquiry (Marketing)

### 4.1 enquiries

Columns:

- `id uuid pk`
- `request_id uuid not null`
- `name text null`
- `email text null`
- `phone text null`
- `message text not null`
- `status text not null` CHECK IN (`NEW`,`IN_PROGRESS`,`CONVERTED`,`CLOSED`)
- `assigned_to_user_id uuid null fk users(id)`
- `created_at`, `updated_at`

Indexes:

- index on `status`
- index on `assigned_to_user_id`

---

## 5. Customer Preferences (Policy Storage)

### 5.1 customer_preferences

Stores current preferences snapshot; effect timing enforced by Subscriptions/Ordering policy.

Columns:

- `id uuid pk`
- `account_id uuid not null fk accounts(id)`
- `request_id uuid not null`
- `version int not null default 1`
- `preferences_json jsonb not null` (validated by application)
- `effective_from_period_start timestamptz null` (for “apply next renewal”)
- `created_at`, `updated_at`

Constraints:

- unique (`account_id`) where `deleted_at is null` (one active record)

Indexes:

- index on `account_id`

---

## 6. Billing (Stripe)

### 6.1 billing_customers

Maps internal account to Stripe customer.

Columns:

- `id uuid pk`
- `account_id uuid not null fk accounts(id)`
- `stripe_customer_id text not null unique`
- `created_at`, `updated_at`

Constraints:

- unique (`account_id`)

---

### 6.2 billing_events

Raw Stripe webhooks (idempotency + audit).

Columns:

- `id uuid pk`
- `request_id uuid not null`
- `stripe_event_id text not null`
- `event_type text not null`
- `livemode boolean not null`
- `payload_json jsonb not null`
- `received_at timestamptz not null default now()`

- `processed_at timestamptz null`
- `process_status text not null` CHECK IN (`RECEIVED`,`PROCESSED`,`FAILED`)
- `failure_reason text null`

- `processing_started_at timestamptz null`
- `processing_attempts int not null default 0`
- `last_error_code text null`

constraints:

- unique (stripe_event_id, livemode)
- processing_attempts >= 0
- processed_at is null OR processed_at >= received_at
- processing_started_at is null OR processing_started_at >= received_at

Indexes:

- index on (`process_status`, `received_at`)
- index on (`stripe_event_id`, `livemode`)

Payload policy (Mandatory):

- `payload_json` MUST be treated as sensitive operational data.
- Do not store the full raw payload unless required for debugging or dispute resolution.
- If stored, payload MUST be redacted (no emails, names, addresses, full card details).
- Preferred: store a minimal subset required for reconciliation:
  - event id/type/livemode
  - object ids (customer, invoice, payment_intent, subscription, checkout_session)
  - amounts/currency/status where applicable

---

### 6.3 billing_transactions

Canonical billing facts derived from Stripe.

Columns:

- `id uuid pk`
- `request_id uuid not null`
- `account_id uuid not null fk accounts(id)`

- `stripe_object_type text not null`
  CHECK IN (`checkout_session`,`invoice`,`payment_intent`,`charge`,`refund`)
- `stripe_object_id text not null`

- `purpose text not null`
  CHECK IN (`PACK_PURCHASE`,`SUBSCRIPTION_PAYMENT`,`CREDITS_TOPUP`,`OTHER`)

- `kind text not null`
  CHECK IN (`CHARGE`,`REFUND`,`ADJUSTMENT`)

- `amount_cents bigint not null`
- `currency text not null`
- `status text not null` CHECK IN (`SUCCEEDED`,`PENDING`,`FAILED`)
- `occurred_at timestamptz not null`
- `created_at`, `updated_at`

Optional correlation fields (recommended):

- `stripe_customer_id text null`
- `stripe_subscription_id text null`
- `stripe_invoice_id text null`

Constraints:

- unique (`stripe_object_type`,`stripe_object_id`,`kind`)
- `amount_cents >= 0`

Indexes:

- index on (`account_id`,`occurred_at`)
- index on (`stripe_customer_id`)
- index on (`stripe_subscription_id`)

### 6.4 billing_line_items

Breakdown of a billing transaction for audit + domain correlation.

Columns:

- `id uuid pk`
- `request_id uuid not null`
- `billing_transaction_id uuid not null fk billing_transactions(id) on delete cascade`

- `line_type text not null` CHECK IN (`PACK`,`SUBSCRIPTION`,`CREDITS_TOPUP`)
- `stripe_price_id text null`
- `quantity int not null default 1` CHECK (`quantity > 0`)

-- Domain correlation (no meaning here; just pointers)

- `bk_reference_type text not null` CHECK IN (`PACK_PRODUCT`,`SUBSCRIPTION_PLAN`)
- `bk_reference_id uuid not null`

- `created_at`, `updated_at`

Constraints:

- unique (`billing_transaction_id`,`line_type`,`bk_reference_type`,`bk_reference_id`)
- (
    (line_type = 'PACK' AND bk_reference_type = 'PACK_PRODUCT')
 OR (line_type = 'SUBSCRIPTION' AND bk_reference_type = 'SUBSCRIPTION_PLAN')
 OR (line_type = 'CREDITS_TOPUP' AND bk_reference_type IN ('PACK_PRODUCT','SUBSCRIPTION_PLAN')) -- if you ever top-up via a SKU; otherwise remove this clause
  )

Indexes:

- index on (`billing_transaction_id`)
- index on (`bk_reference_type`,`bk_reference_id`)

### 6.5 billing_refunds

Refund records linked to billing transactions.

Columns:

- `id uuid pk`
- `request_id uuid not null`
- `account_id uuid not null fk accounts(id)`
- `billing_transaction_id uuid not null fk billing_transactions(id) on delete cascade`
- `stripe_refund_id text not null unique`          -- Stripe `re_...`
- `stripe_charge_id text null`                     -- Stripe `ch_...` (optional)
- `amount_cents bigint not null` CHECK (`amount_cents > 0`)
- `currency text not null`
- `status text not null` CHECK IN (`PENDING`,`SUCCEEDED`,`FAILED`)
- `reason text null`
- `created_at`, `updated_at`

Constraints:

- unique (`billing_transaction_id`,`stripe_refund_id`)
- `amount_cents > 0`

Indexes:

- index on (`account_id`,`created_at`)
- index on (`billing_transaction_id`)

---

## 7. Packs (Economic Anchor)

### 7.1 pack_products

Catalog of pack SKUs.

Columns:

- `id uuid pk`
- `sku text not null unique`
- `title text not null`
- `meals_total int not null` CHECK (`meals_total > 0`)
- `price_cents bigint not null`
- `currency text not null`
- `active boolean not null default true`
- `created_at`, `updated_at`

---

### 7.2 packs

Customer-owned packs.

Columns:

- `id uuid pk`
- `request_id uuid not null`
- `account_id uuid not null fk accounts(id)`
- `pack_product_id uuid not null fk pack_products(id)`
- `status text not null` CHECK IN (`ACTIVE`,`EXHAUSTED`,`CANCELLED`)
- `meals_remaining int not null` CHECK (`meals_remaining >= 0`)
- `locked_credits_remaining int not null` CHECK (`locked_credits_remaining >= 0`)
- `purchased_at timestamptz not null`
- `exhausted_at timestamptz null`
- `created_at`, `updated_at`

Constraints:

- `locked_credits_remaining = meals_remaining` (v1 invariant; may evolve)

Indexes:

- index on (`account_id`,`status`)

---

### 7.3 pack_events

Append-only events for pack lifecycle.

Columns:

- `id uuid pk`
- `request_id uuid not null`
- `account_id uuid not null fk accounts(id)`
- `pack_id uuid not null fk packs(id)`
- `event_type text not null` CHECK IN (
  `PACK_PURCHASED`,
  `PACK_CONSUMED`,
  `PACK_EXHAUSTED`,
  `PACK_ADJUSTED`
)
- `delta_meals int not null`
- `delta_locked_credits int not null`
- `actor_type text not null`
- `actor_user_id uuid null fk users(id)`
- `reason text null`
- `created_at timestamptz not null default now()`

Indexes:

- index on (`pack_id`,`created_at`)

---

## 8. Subscriptions (Capability Entitlements)

### 8.1 subscription_plans

Columns:

- `id uuid pk`
- `provider_plan_id text not null unique`  -- Stripe `price_...`
- `currency text not null default 'AUD'`
- `provider text not null default 'stripe'`
- `key text not null unique`
- `title text not null`
- `status text not null` CHECK IN (`ACTIVE`,`RETIRED`)

- `created_at`, `updated_at`

---

### 8.2 subscriptions

Columns:

- `id uuid pk`
- `request_id uuid not null`
- `account_id uuid not null fk accounts(id)`
- `plan_id uuid not null fk subscription_plans(id)`
- `provider text not null default 'stripe'`
- `provider_subscription_id text null unique`   -- Stripe `sub_...`
- `provider_customer_id text null`              -- Stripe `cus_...`
- `status text not null` CHECK IN (`INCOMPLETE`,`ACTIVE`,`PAST_DUE`,`PAUSED`,`CANCELLED`)
-- Make periods nullable to allow INCOMPLETE creation pre-webhook:
- `current_period_start timestamptz null`
- `current_period_end timestamptz null`
- `auto_pause_on_pack_zero boolean not null default true`
- `paused_at timestamptz null`
- `cancelled_at timestamptz null`
- `cancel_at_period_end boolean not null default false`
- `resume_at timestamptz null`
- `created_at`, `updated_at`

Constraints:
-- Only one live subscription per account (v1 lock-down)
-- NOTE: use a partial unique index in Postgres.
unique (account_id)
where status in ('INCOMPLETE','ACTIVE','PAST_DUE','PAUSED')

- If status IN (`ACTIVE`,`PAST_DUE`,`PAUSED`) then `current_period_start/end` must be not null.
- If status=`CANCELLED` then `cancelled_at` may be not null (preferred).
-- Periods required once subscription is in a running state
(
  status not in ('ACTIVE','PAST_DUE','PAUSED')
  OR (current_period_start is not null AND current_period_end is not null)
)

-- If cancelled, cancelled_at should be set (soft requirement -> enforce if you want)
-- Strong version:
-- (status != 'CANCELLED' OR cancelled_at is not null)

-- Resume scheduling only valid when paused
(
  resume_at is null OR status = 'PAUSED'
)

-- cancel_at_period_end only meaningful when not cancelled
(
  status != 'CANCELLED' OR cancel_at_period_end = false
)

Indexes:

- index on (`account_id`,`status`)

---

### 8.3 subscription_entitlements

Monthly capability counters and flags.

Columns:

- `id uuid pk`
- `request_id uuid not null`
- `account_id uuid not null fk accounts(id)`
- `subscription_id uuid not null fk subscriptions(id)`
- `period_start timestamptz not null`
- `period_end timestamptz not null`
- `preset_access boolean not null default false`
- `override_access boolean not null default false`
- `override_allowance int not null default 0`
- `override_used int not null default 0`
- `promo_unlocked_credits_grant int not null default 0`
- `event_type text not null`
- `actor_type text not null`
- `actor_user_id uuid null fk users(id)`
- `metadata_json jsonb null`
- `billing_transaction_id uuid null fk billing_transactions(id)`
- `idempotency_key text not null`
- `created_at`, `updated_at`

Constraints:

- unique (`subscription_id`,`period_start`)
- unique (`account_id`,`idempotency_key`)
- `period_end > period_start`
- `override_used <= override_allowance`

Indexes:

- index on (`subscription_id`,`period_start`)
- index on (`subscription_id`,`created_at`)
- index on (`account_id`,`created_at`)

### 8.4 subscription_events (Recommended, Locked)

Append-only lifecycle + entitlement audit events for subscriptions.

Columns:

- `id uuid pk`
- `request_id uuid not null`
- `account_id uuid not null fk accounts(id)`
- `subscription_id uuid not null fk subscriptions(id)`
- `billing_event_id uuid null fk billing_events(id)`                 -- when driven by webhook
- `billing_transaction_id uuid null fk billing_transactions(id)`     -- when money fact exists
- `event_type text not null` CHECK IN (
  `SUBSCRIPTION_CREATED`,
  `SUBSCRIPTION_CHECKOUT_STARTED`,
  `SUBSCRIPTION_CHECKOUT_COMPLETED`,
  `SUBSCRIPTION_INVOICE_PAID`,
  `SUBSCRIPTION_INVOICE_PAYMENT_FAILED`,
  `SUBSCRIPTION_PAUSED`,
  `SUBSCRIPTION_RESUMED`,
  `SUBSCRIPTION_CANCEL_REQUESTED`,
  `SUBSCRIPTION_CANCELLED`,
  `SUBSCRIPTION_PROVIDER_UPDATED`,
  `SUBSCRIPTION_ENTITLEMENTS_GRANTED`
)
- `actor_type text not null`
- `actor_user_id uuid null fk users(id)`
- `idempotency_key text not null`
- `metadata_json jsonb null`
- `created_at timestamptz not null default now()`

Constraints:

- unique (`account_id`,`idempotency_key`)
- `billing_event_id is null OR billing_transaction_id is not null`    -- if you want to require money fact for some events, adjust

Indexes:

- index on (`subscription_id`,`created_at`)
- index on (`account_id`,`created_at`)
- index on (`billing_event_id`)
- index on (`billing_transaction_id`)

---

## 9. Ordering (Weekly Execution Engine)

### 9.1 order_weeks

Defines canonical week identity.

Columns:

- `id uuid pk`
- `week_key text not null unique` (e.g., `2026-W03`)
- `window_opens_at timestamptz not null`
- `window_closes_at timestamptz not null`
- `production_cutoff_at timestamptz not null`
- `created_at`, `updated_at`

---

### 9.2 orders

One order per account per week.

Columns:

- `id uuid pk`
- `request_id uuid not null`
- `account_id uuid not null fk accounts(id)`
- `week_id uuid not null fk order_weeks(id)`
- `status text not null` CHECK IN (`DRAFT`,`CONFIRMED`,`LOCKED`,`FULFILLED`,`CANCELLED`)
- `confirmed_at timestamptz null`
- `locked_at timestamptz null`
- `cancelled_at timestamptz null`
- `cancel_reason text null`
- `created_at`, `updated_at`

Constraints:

- unique (`account_id`,`week_id`)

Indexes:

- index on (`account_id`,`status`)

---

### 9.3 order_lines

Columns:

- `id uuid pk`
- `order_id uuid not null fk orders(id) on delete cascade`
- `dish_id uuid not null` (future FK to meals/dishes table)
- `quantity int not null` CHECK (`quantity > 0`)
- `created_at`, `updated_at`

Indexes:

- index on `order_id`

---

### 9.4 order_allocations

Canonical preset resolution stored at confirmation.

Columns:

- `id uuid pk`
- `order_id uuid not null fk orders(id) on delete cascade`
- `allocation_json jsonb not null`
- `created_at`, `updated_at`

Constraints:

- unique (`order_id`)

---

### 9.5 order_events

Append-only order events.

Columns:

- `id uuid pk`
- `request_id uuid not null`
- `order_id uuid not null fk orders(id)`
- `account_id uuid not null fk accounts(id)`
- `idempotency_key text not null`
- `event_type text not null`
- `actor_type text not null`
- `actor_user_id uuid null fk users(id)`
- `reason text null`
- `metadata_json jsonb null`
- `created_at timestamptz not null default now()`

Constraints:

- unique (`order_id`, `idempotency_key`)

Indexes:

- index on (`order_id`,`created_at`)
- index on (`order_id`, `idempotency_key`)

---

## 10. Credits Ledger (Locked vs Unlocked)

### 10.1 credit_entries

Append-only ledger.

Columns:

- `id uuid pk`
- `request_id uuid not null`
- `account_id uuid not null fk accounts(id)`
- `credit_class text not null` CHECK IN (`LOCKED`,`UNLOCKED`)
- `amount int not null` (positive grant, negative reversal/consumption)
- `source text not null` CHECK IN (`PACK`,`SUBSCRIPTION_PROMO`,`REFUND`,`ADMIN`,`SYSTEM`,`GAMIFICATION`)
- `reference_type text not null`
- `reference_id uuid not null`
- `expires_at timestamptz null`
- `created_at timestamptz not null default now()`
- `idempotency_key text not null`

Constraints:

- unique (`account_id`, `idempotency_key`)
- `amount <> 0`
- `expires_at is null OR expires_at >= created_at`

Indexes:

- index on (`account_id`,`credit_class`,`created_at`)
- index on `expires_at`
- index on (`account_id`, `idempotency_key`)

Notes:

- LOCKED credits are primarily represented by `packs.locked_credits_remaining` in v1, but the ledger is authoritative once implemented.

---

## 11. Reward Shop (Items Inventory)

### 11.1 reward_items

Per-account item inventory.

Columns:

- `id uuid pk`
- `request_id uuid not null`
- `account_id uuid not null fk accounts(id)`
- `item_type text not null` CHECK IN (
  `LATE_ORDER_VOUCHER`,
  `CANCELLATION_VOUCHER`,
  `MEAL_TOKEN`,
  `FOOD_ITEM_VOUCHER`
)
- `status text not null` CHECK IN (`ISSUED`,`REDEEMED`,`EXPIRED`,`REVOKED`)
- `issued_at timestamptz not null`
- `expires_at timestamptz null`
- `redeemed_at timestamptz null`
- `metadata_json jsonb null`
- `created_at`, `updated_at`

Indexes:

- index on (`account_id`,`item_type`,`status`)

---

### 11.2 reward_item_events

Append-only events for purchase/issue/redeem.

Columns:

- `id uuid pk`
- `request_id uuid not null`
- `account_id uuid not null fk accounts(id)`
- `reward_item_id uuid not null fk reward_items(id)`
- `credit_entry_id uuid null fk credit_entries(id)`
  - Present for PURCHASE events to link the spend to the ledger entry.
- `event_type text not null` CHECK IN (
  `REWARD_ITEM_PURCHASED`,
  `REWARD_ITEM_ISSUED`,
  `REWARD_ITEM_REDEEMED`,
  `REWARD_ITEM_EXPIRED`,
  `REWARD_ITEM_REVOKED`
)
- `actor_type text not null`
- `actor_user_id uuid null fk users(id)`
- `credit_amount_spent int null`
- `created_at timestamptz not null default now()`
- `idempotency_key text not null`

Constraints:

- unique (`account_id`,`idempotency_key`)

Indexes:

- index on (`reward_item_id`,`created_at`)

---

## 12. Operational Failures

### 12.1 operational_failures

Records operational disruption incidents.

Columns:

- `id uuid pk`
- `request_id uuid not null`
- `category text not null` CHECK IN (
  `SUPPLY`,
  `KITCHEN_PRODUCTION`,
  `ORDERING_SYSTEM`,
  `DELIVERY`,
  `HUMAN_PROCESS`,
  `FORCE_MAJEURE`
)
- `status text not null` CHECK IN (`OPEN`,`RESOLVED`,`CLOSED`)
- `summary text not null`
- `details text null`
- `affected_week_id uuid null fk order_weeks(id)`
- `affected_account_id uuid null fk accounts(id)`
- `created_by_user_id uuid null fk users(id)`
- `created_at`, `updated_at`

Indexes:

- index on `category`
- index on `status`

---

### 12.2 operational_responses

Records responses applied under policy.

Columns:

- `id uuid pk`
- `request_id uuid not null`
- `failure_id uuid not null fk operational_failures(id)`
- `response_type text not null` CHECK IN (`DELAY`,`SUBSTITUTION`,`CREDIT`,`REFUND`,`CYCLE_CANCELLATION`)
- `actor_type text not null`
- `actor_user_id uuid null fk users(id)`
- `reference_type text null`
- `reference_id uuid null`
- `reason text not null`
- `created_at timestamptz not null default now()`

Indexes:

- index on (`failure_id`,`created_at`)

---

## 13. Cross-Cutting Audit Log (Optional but Recommended)

### 13.1 audit_events

Single-stream audit for security/business actions.

Columns:

- `id uuid pk`
- `request_id uuid not null`
- `event_type text not null`
- `actor_type text not null`
- `actor_user_id uuid null fk users(id)`
- `account_id uuid null fk accounts(id)`
- `entity_type text null`
- `entity_id uuid null`
- `metadata_json jsonb null`
- `created_at timestamptz not null default now()`

Indexes:

- index on (`event_type`,`created_at`)
- index on (`account_id`,`created_at`)

---

## 14. Planned Tables (Placeholders; do not implement without module specs)

These are intentionally not fully defined until their module specs are canonical:

- `meals` / `dishes` / `menu_cycles`
- `delivery_runs` / `delivery_stops`
- `notifications` (email/in-app)
- `chat_*` tables (if/when `chat_module.md` is locked)

---

## 15. Migration & Implementation Notes

- Use `pgcrypto` for `gen_random_uuid()`
- Use server-side timestamps (default `now()`)
- Consider triggers for `updated_at` consistency
- Enforce uniqueness and foreign keys at the DB level

---

## 16. Final Statement

This schema encodes the **economic and operational invariants** of Balance Kitchen.

It is designed to be:

- secure
- auditable
- future-proof
- resistant to entitlement drift

Any implementation that bypasses these constraints is invalid by definition.
