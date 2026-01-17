# balance_kitchen_schema.md — Canonical Database Specification (v1.0)

> **Authoritative database schema document** for the Balance Kitchen (BK) platform.
>
> This document defines the **production-ready PostgreSQL schema** for BK.
> It is the source of truth for tables, columns, constraints, indexes, and invariants.
>
> The schema is designed to align with:
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

### 1.3 Actor Attribution

Tables representing actions SHOULD store:
- `actor_type text not null` (e.g., `system`, `admin`, `account_manager`, `client`)
- `actor_user_id uuid null` (nullable for system)

### 1.4 Money

- Use `amount_cents bigint not null` and `currency text not null` (ISO 4217)
- Never use floating point for money

### 1.5 Enumerations

Use `text` columns with CHECK constraints for enums (portable and Drizzle-friendly).

---

## 2. Identity & Access Control

### 2.1 users

Represents a person who can authenticate.

Columns:
- `id uuid pk`
- `email text not null unique`
- `email_verified_at timestamptz null`
- `display_name text null`
- `status text not null` CHECK IN (`ACTIVE`,`SUSPENDED`,`DELETED`)
- `created_at`, `updated_at`, `deleted_at`

Indexes:
- unique index on `lower(email)`

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
- `stripe_event_id text not null unique`
- `event_type text not null`
- `livemode boolean not null`
- `payload_json jsonb not null`
- `received_at timestamptz not null default now()`
- `processed_at timestamptz null`
- `process_status text not null` CHECK IN (`RECEIVED`,`PROCESSED`,`FAILED`)
- `failure_reason text null`

Indexes:
- index on `process_status`
- index on `received_at`

---

### 6.3 billing_transactions

Canonical billing facts derived from Stripe.

Columns:
- `id uuid pk`
- `request_id uuid not null`
- `account_id uuid not null fk accounts(id)`
- `stripe_object_type text not null` (invoice, payment_intent, charge)
- `stripe_object_id text not null`
- `kind text not null` CHECK IN (`CHARGE`,`REFUND`,`ADJUSTMENT`)
- `amount_cents bigint not null`
- `currency text not null`
- `status text not null` CHECK IN (`SUCCEEDED`,`PENDING`,`FAILED`)
- `occurred_at timestamptz not null`
- `created_at`, `updated_at`

Constraints:
- unique (`stripe_object_type`,`stripe_object_id`,`kind`)

Indexes:
- index on (`account_id`,`occurred_at`)

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
- `status text not null` CHECK IN (`ACTIVE`,`PAUSED`,`CANCELLED`)
- `current_period_start timestamptz not null`
- `current_period_end timestamptz not null`
- `auto_pause_on_pack_zero boolean not null default true`
- `paused_at timestamptz null`
- `cancelled_at timestamptz null`
- `created_at`, `updated_at`

Indexes:
- index on (`account_id`,`status`)

---

### 8.3 subscription_entitlements

Monthly capability counters and flags.

Columns:
- `id uuid pk`
- `request_id uuid not null`
- `subscription_id uuid not null fk subscriptions(id)`
- `period_start timestamptz not null`
- `period_end timestamptz not null`
- `preset_access boolean not null default false`
- `override_access boolean not null default false`
- `override_allowance int not null default 0`
- `override_used int not null default 0`
- `promo_unlocked_credits_grant int not null default 0`
- `created_at`, `updated_at`

Constraints:
- unique (`subscription_id`,`period_start`)

Indexes:
- index on (`subscription_id`,`period_start`)

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
- `event_type text not null`
- `actor_type text not null`
- `actor_user_id uuid null fk users(id)`
- `reason text null`
- `metadata_json jsonb null`
- `created_at timestamptz not null default now()`

Indexes:
- index on (`order_id`,`created_at`)

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

Indexes:
- index on (`account_id`,`credit_class`,`created_at`)
- index on `expires_at`

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

