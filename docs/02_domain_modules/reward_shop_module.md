# reward_shop_module.md — Reward Shop & Entitlement Exchange (v0.1)

> **Canonical policy specification** for the Balance Kitchen (BK) Reward Shop.
>
> The Reward Shop is a **controlled exchange layer** where customers convert **unlocked credits** into **items**.
>
> It is not a marketplace, not a discount engine, and not a gamification system.
> It is a **policy‑governed entitlement exchange** that sits downstream of Credits and upstream of Ordering.

---

## 0. Status & Scope

**Status:** Draft v0.1 (Policy‑Only)

**Scope:**

- Reward shop responsibilities and boundaries
- Item types and exchange rules
- Redemption semantics
- Anti‑abuse guardrails

**Explicitly out of scope:**

- UI design
- Animations or visual treatments
- Pricing psychology
- Game mechanics (levels, streaks, dopamine loops)

This document must align with:

- `balance.md`
- `balance_kitchen_business_model.md`
- `credits_module.md`
- `ordering_module.md`
- `operational_failure_model.md`

---

## 1. Purpose & Philosophy

The Reward Shop exists to:

- Provide **controlled optional flexibility** to customers
- Convert unlocked credits into **explicit entitlements**
- Enable future gamification **without contaminating core economics**

The Reward Shop is intentionally conservative.
It prioritises clarity, auditability, and fairness over excitement.

Tone guidance:

- Lightly positive
- Never urgent
- Never competitive
- Never tied to core economic pressure

---

## 2. Core Invariants (Locked)

The following rules must **never** be violated:

1. Only **unlocked credits** may be spent in the Reward Shop
2. Reward Shop purchases **never purchase meals directly**
3. Reward Shop outputs **items**, not credits
4. Items interact with Ordering or Operations — not Credits
5. Reward Shop purchases are **non‑refundable**
6. Reward Shop activity must not bypass pack economics

Any implementation that violates these invariants is invalid.

---

## 3. Responsibilities & Boundaries

### 3.1 Reward Shop Owns

- Item catalogue (types + policy)
- Exchange rules (credits → items)
- Item expiry and redemption constraints
- Item inventory per account
- Audit events for purchase and redemption

### 3.2 Reward Shop Does Not Own

- Credit ledger mechanics (Credits module)
- Meal ordering or pack consumption (Ordering module)
- Billing or payment (Billing module)
- Subscription lifecycle (Subscriptions module)

---

## 4. Eligibility to Use the Reward Shop

A customer may use the Reward Shop if:

- They have **unlocked credits > 0**
- Their account is not administratively restricted

Pack balance **may be zero**.
The Reward Shop remains accessible as long as unlocked credits exist.

---

## 5. Reward Shop Items (v0.1)

Reward Shop items are **entitlement artifacts** stored in a per‑account inventory.

Items are not credits and not meals.

### 5.1 Canonical Item Types

#### 5.1.1 Late‑Order Voucher

**Purpose:**
Allows ordering after the weekly cutoff.

**Policy:**

- Extends ordering eligibility by **48 hours** after the standard cutoff
- May only be redeemed once per week
- Redemption is constrained by subscription tier and reason

Redemption contract (Mandatory):

- Redemption consumes a concrete inventory item row (not a boolean flag).
- Ordering must provide a `redeemLateOrderVoucherUseCase` (or equivalent) that:
  - verifies ownership (account_id)
  - verifies item not expired/revoked/already redeemed
  - records redemption with audit event
  - is idempotent by `(account_id, item_id)`

---

#### 5.1.2 Cancellation Voucher (Future)

**Purpose:**
Allows self‑cancellation without AM involvement.

**Policy:**

- May cancel an order in `CONFIRMED` state
- Must be redeemed **before production cutoff**
- Cannot cancel `LOCKED` orders

---

#### 5.1.3 Meal Token (Future)

**Purpose:**
Represents a single meal entitlement outside of packs.

**Policy:**

- Exists in a **separate token inventory**
- Does not convert into credits
- Does not merge with pack balance
- Ordering may consume meal tokens only if explicitly allowed by policy

Meal tokens are deliberately isolated to avoid pack erosion.

---

#### 5.1.4 Food Item Voucher (Future)

**Purpose:**
Allows redemption of specific food items or bonuses.

**Policy:**

- Does not affect pack balance
- Redemption rules are item‑specific

---

## 6. Exchange Rules (Credits → Items)

### 6.1 Purchase Preconditions

To purchase a Reward Shop item:

- Account must have sufficient **unlocked credits**
- Item must be eligible for the account’s tier and state

### 6.2 Exchange Semantics

- Unlocked credits are consumed
- Item is issued into account inventory
- Exchange is **atomic and idempotent**
Persistence mapping (schema-aligned):
- Issue the inventory item into `reward_items`
- Record the purchase and issuance into `reward_item_events`
- Consume unlocked credits via `credit_entries` (negative UNLOCKED entry)
- The entire exchange MUST commit atomically

If an exchange partially fails, it must rollback safely.

### 6.2.1 Atomic exchange contract (Mandatory)

Reward Shop purchase MUST be a single atomic operation:

Within one DB transaction:

1) Claim purchase idempotency key (unique by `(account_id, idempotency_key)`).
2) Verify sufficient unlocked credits at commit time (not check-then-write).
3) Insert a credits ledger consumption entry (unlocked class).
4) Insert an inventory item issuance row.
5) Emit audit event(s).

If any step fails, the entire purchase must rollback.

### 6.3 Refund Policy (Locked)

- Reward Shop purchases are **never refundable**
- Unredeemed items do not qualify for refunds

---

## 7. Item Inventory Model

Each account maintains an **item inventory**.

Inventory items include:

- `item_id`
- `item_type`
- `issued_at`
- `expires_at?`
- `redeemed_at?`
- `source` (reward_shop)

Items:

- May expire
- May be redeemed once unless explicitly reusable
- Are never silently removed

Inventory invariants (Mandatory):

- Each inventory item row is the sole proof of ownership.
- Redemption is one-way:
  - once `redeemed_at` is set, it must never be cleared.
- An item may be redeemed at most once unless explicitly marked reusable.
- Redemption operations MUST be idempotent by `(account_id, item_id)`.

---

## 8. Redemption Rules

### 8.1 General Redemption Constraints

- Redemption must validate current order state
- Redemption must validate timing (window / cutoff)
- Redemption must emit audit events

### 8.2 Interaction With Ordering

Examples:

- Late‑order voucher:
  - Temporarily re‑opens ordering eligibility
  - Does not modify pack balance

- Cancellation voucher:
  - Cancels a confirmed order
  - Triggers pack/locked‑credit reversal

Reward Shop never performs ordering actions directly; it authorises them.

---

## 9. Anti‑Abuse Guardrails

The Reward Shop must enforce:

- Rate limits on purchases and redemptions
- Per‑period caps per item type
- Prevention of rapid buy‑redeem loops
- Eligibility checks tied to subscription tier

Idempotency (Mandatory):

- `purchaseItem` and `redeemItem` MUST accept an `idempotency_key`.
- Duplicate keys are a no-op returning the original result.
- This is required to prevent duplicate spends on client retries or flaky networks.

Schema requirement (Mandatory):

- `reward_item_events` MUST include `idempotency_key text not null`
- enforce unique (`account_id`,`idempotency_key`) OR unique (`reward_item_id`,`idempotency_key`)
  depending on implementation preference.

Rationale:

- Prevent duplicate spend + duplicate issue under retries.

Anti-loop policy (Mandatory):

- The system MUST enforce per-item-type cooldowns and/or per-period caps.
- Example (v0.1):
  - Late-order vouchers: max 1 purchase per week, max 1 redemption per week.
- Violations return `429 RATE_LIMITED` or `403 FORBIDDEN` depending on policy.
- Suspicious patterns must emit an admin-visible event.

Suspicious patterns must surface to admin.

---

## 10. Audit & Events (Canonical)

Reward Shop must emit structured events:

- `REWARD_ITEM_PURCHASED`
- `REWARD_ITEM_ISSUED`
- `REWARD_ITEM_REDEEMED`
- `REWARD_ITEM_EXPIRED`
- `REWARD_ITEM_REVOKED`

Each event includes:

- actor
- account_id
- item_type
- credit_amount_spent
- justification (if applicable)

---

## 11. Security & Access Control

Reward Shop actions are:

- Session‑bearing
- BalanceGuard‑protected
- Subject to rate limiting

Only the account owner (or admin) may purchase or redeem items.

---

## 12. What the Reward Shop Explicitly Forbids

- Purchasing meals directly
- Purchasing packs or subscriptions
- Refunding reward purchases
- Converting items back into credits
- Silent inventory mutation
- Gamifying core economic pressure

---

## 13. Future Extensions (Guarded)

This model safely supports:

- Expanded item catalogue
- Enterprise‑specific items
- Seasonal promotions

All extensions must preserve the locked invariants.

---

## 14. Final Statement

The Reward Shop exists to provide **flexibility without erosion**.

It allows customers to use unlocked value in controlled ways while preserving:

- pack economics
- subscription integrity
- auditability

Any implementation that bypasses these rules is invalid by definition.
