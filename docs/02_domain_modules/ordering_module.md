# ordering_module.md — Weekly Ordering (Window, Presets, Entitlements)

> **Canonical specification** for the Balance Kitchen (BK) Ordering module.
>
> Ordering is the **weekly execution engine** of BK.
>
> It enforces:
>
> - the **weekly ordering window**
> - **pack** eligibility (economic anchor)
> - **subscription** tier entitlements (capabilities)
> - **preset-driven allocation** (percentage-based)
> - controlled **exceptions** (late orders, cancellations, overrides)
>
> Ordering is **policy + workflow**. It is not UI.

---

## 0. Status & Change Log

**Status:** Draft v1.0 (Proposed)

**This document must align with:**

- `balance.md`
- `balance_kitchen_business_model.md`
- `balance_kitchen_architecture.md`
- `balanceguard.md`
- `operational_failure_model.md`

---

## 1. Responsibilities (Non‑Negotiable)

### 1.1 Ordering Owns

Ordering **owns**:

- The **weekly ordering window** (open/close) and all related gates
- The **order lifecycle state machine**
- **Drafting and confirmation** of weekly orders
- Enforcement of:
  - **pack balance** (hard gate)
  - **subscription active state** (derived gate)
  - **tier entitlements** (capability gates)
  - **preset eligibility** (tier-gated)
  - **override eligibility** (tier-gated)
- **Preset application** (deterministic resolution at confirmation)
- Exception hooks:
  - late ordering (tier + reason constrained)
  - cancellations (AM-only)
  - manual overrides (AM-only)

### 1.2 Ordering Does Not Own

Ordering **does not own**:

- Preference definition or storage (Preferences module)
- Menu and dish definitions (Menu/Meals module)
- Billing and payment facts (Billing module)
- Credits ledger mechanics (Credits module, planned)
- Delivery runs and routing (Delivery module)
- Notifications transport (Notifications module)

---

## 2. Core Concepts

### 2.1 Weekly Window (Kitchen-Authoritative)

Ordering operates on a weekly cadence governed by the **kitchen location timezone**.

- **Timezone authority:** Kitchen location (Brisbane / Australia)

### 2.2 One Order Per Account Per Week

- An account may place **at most one order** per weekly window.
- The order begins as `DRAFT` and is finalized by `CONFIRMED`.

### 2.3 Packs vs Entitlements (Important Distinction)

- **Meals come from packs** (economic anchor).
- **Subscription entitlements are capabilities**, reset monthly.

Ordering enforces both:

- **Pack balance** determines how many meals may be ordered.
- **Subscription entitlements** determine what capabilities are available while ordering.

---

## 3. Weekly Ordering Window (Policy)

### 3.1 Canonical Times

Per the business model:

- **Opens:** Friday **12:00 PM** (kitchen timezone)
- **Closes:** Monday **12:00 AM** (kitchen timezone)

### 3.2 Production Cutoff (Lock Point)

Orders are **LOCKED** at the kitchen **production cutoff**.

- **Lock trigger:** Internal production cutoff
- **Default (recommended):** Monday **09:00 AM** (kitchen timezone)
- **Configurable:** Yes (must be configured centrally, not per-request)

Rationale:

- Window close ends customer ordering.
- Production cutoff ends operational change tolerance.

### 3.3 Window State

Ordering maintains a derived window state:

- `WINDOW_CLOSED`
- `WINDOW_OPEN`

Window state is computed from current time and configured schedule.

---

## 4. Order Lifecycle (State Machine)

### 4.1 States

```text
WINDOW_CLOSED (no order creation)
WINDOW_OPEN
  → DRAFT
  → CONFIRMED
  → LOCKED
  → FULFILLED | CANCELLED
```

### 4.2 State Semantics

- `DRAFT`
  - order exists and is editable
  - no irreversible operational handoff

- `CONFIRMED`
  - order is finalized by the customer
  - preset allocation is resolved **canonically** at confirm time
  - pack consumption is applied immediately (see Section 6)

- `LOCKED`
  - order is immutable for production stability
  - only handled via operational exception pathways

- `FULFILLED`
  - meals delivered or otherwise completed

- `CANCELLED`
  - order cancelled by AM (or voucher flow in future)

### 4.3 Allowed Transitions (v1)

| From | To | Who | Constraints |
| ------ | ---- | ----- | ------------ |
| — | DRAFT | customer | only while WINDOW_OPEN |
| DRAFT | CONFIRMED | customer | only while WINDOW_OPEN |
| CONFIRMED | LOCKED | system | at production cutoff |
| DRAFT | CANCELLED | AM | allowed while WINDOW_OPEN |
| CONFIRMED | CANCELLED | AM | allowed until production cutoff |
| LOCKED | CANCELLED | AM/admin | only as operational exception (see Section 10) |
| LOCKED | FULFILLED | system/admin | after fulfilment |

---

## 5. Eligibility Gates (Enforced on Every Mutation)

Ordering must enforce the following **before** any creation, update, or confirm:

### 5.1 Pack Gate (Hard)

- Account must have **pack balance > 0**.
- The maximum number of meals ordered must not exceed pack balance.

### 5.2 Subscription Active Gate (Derived)

- Subscription is considered **active only while pack balance remains**.
- Ordering does not decide subscription state; it validates the derived rule.

### 5.3 Tier Capability Gates (Monthly)

Ordering enforces tier-gated capabilities, including:

- Preset access (enabled/disabled)
- Override access (enabled/disabled)
- Override allowance (count, reset monthly)

### 5.4 Preference Constraints (Read-Only)

Ordering must respect:

- Allergens
- Exclusions
- Tier ingredient access

Ordering **reads** preference evaluation results; it does not implement preference storage.

---

## 6. Pack Consumption Rule (Locked)

### 6.1 When Packs Decrement

- Pack balance decrements **immediately on CONFIRM**.

Rationale:

- Prevents over-commit across concurrent sessions
- Produces a stable economic record for operations

**Locked credit consumption:**

When pack meals decrement on confirmation, the system implicitly consumes the corresponding **locked credits** (pack-backed meal value).  
Unlocked credits are never consumed by Ordering to purchase meals.

### 6.2 Idempotency Requirements

Confirm operations must be **idempotent**.

- Repeated confirm requests must not consume packs multiple times.
- Confirm must use a deterministic idempotency key (order_id + state transition).

---

## 7. Drafting Rules

### 7.1 Draft Creation

- A draft may be created only while `WINDOW_OPEN`.
- If an order already exists for the week, the user receives the existing draft.

### 7.2 Draft Editing

- Draft edits are allowed only while `WINDOW_OPEN`.
- Draft edits must validate pack availability and dish validity.

### 7.3 One Order Constraint

- The system must enforce a uniqueness rule for: (account_id, week_id).

---

## 8. Preset‑Driven Allocation (Core Mechanic)

### 8.1 Resolution Timing (Locked)

- Presets are resolved **once at CONFIRM**.
- During drafting, the UI may show a **preview**, but the canonical record is produced on confirm.

### 8.2 Determinism (Required)

Preset resolution must be deterministic:

- Same inputs → same allocation
- No randomness
- No time-dependent branching

### 8.3 Inputs

Preset resolution uses:

- Weekly order (dish selections + quantities)
- Stored preset definitions (from Preferences)
- Tier ingredient access rules (from Subscriptions)
- Preference constraints (from Preferences)

### 8.4 Outputs

Ordering produces:

- Per-meal allocation plan
  - vegetable/carbohydrate distribution resolved from percentages
- Any applied tier constraints (silently enforced)

### 8.5 Constraint Handling

If presets cannot be satisfied due to constraints:

- The confirm must fail with a safe, user-facing error
- Or, if policy allows, route to an AM exception workflow

Policy preference:

- Fail closed unless an explicit AM override is requested.

---

## 9. Overrides (Tier‑Gated)

### 9.1 Override Availability

Overrides are allowed only when:

- Tier enables overrides
- Monthly override allowance has remaining quota

### 9.2 Override Ordering

- Overrides apply **after** preset resolution.

### 9.3 Override Safety

Overrides must never violate:

- Allergens
- Hard exclusions
- Ingredient tier access

If an override violates constraints:

- Reject the override
- Provide a safe explanation (no sensitive data leakage)

---

## 10. Cancellations & Exceptions

### 10.1 Cancellation Authority (Locked)

- Customers cannot self-cancel in v1.
- **Account Manager (AM) only** may cancel.
- Future: voucher-based self-cancel is permitted by tier.

**Cancellation voucher (future):**

A Reward Shop cancellation voucher may enable self-cancellation only when:

- order is in `CONFIRMED`
- current time is before production cutoff

Self-cancel is never permitted once an order is `LOCKED`.

### 10.2 Cancellation Windows

AM cancellations are allowed:

- `DRAFT` → cancel any time while `WINDOW_OPEN`
- `CONFIRMED` → cancel up to production cutoff

After `LOCKED`:

- cancellation is treated as an **operational exception**
- governed by `operational_failure_model.md`

### 10.3 Effects of Cancellation

On AM cancellation:

- Pack consumption must be reversed safely:
  - if packs decremented at confirm, a cancellation reversal must restore the appropriate amount
  - reversals must be auditable

Note:

- If Credits ledger exists, reversals should be expressed as ledger adjustments.

### 10.4 Late Ordering (Missed Cut‑Off)

Current policy:

- Late ordering may be accepted at AM discretion
- Discretion is **constrained** by:
  - tier
  - reason

Future policy:

- Voucher-based late ordering (consumable, time-bound)

All late-order exceptions must:

- record a reason code
- record authorizing actor
- emit audit events

**Voucher authorization (future):**

Late ordering may also be authorized by a Reward Shop **late-order voucher**:

- voucher extends eligibility by 48 hours after standard cutoff
- voucher does not change pack balance
- voucher redemption must be audited and idempotent
- See `reward_shop_module.md` for voucher authorization rules.
- Reward Shop items are defined in `reward_shop_module.md`.

---

## 11. Monthly Entitlements (Capability Ledger)

Subscription entitlements reset on a monthly cadence.

### 11.0 Meal Tokens (Future)

Meal tokens are Reward Shop items stored in a separate account inventory.

- They do not convert into credits
- They do not merge with pack balance
- Ordering may consume meal tokens only if explicitly enabled by policy

### 11.1 Canonical v1 Capability Entitlements

Ordering recognizes the following v1 entitlements:

1. **Preset access** (enabled/disabled)
2. **Override access** (enabled/disabled)
3. **Override allowance** (count, resets monthly)
4. **Promo credit entitlement grant** (see 11.2)

### 11.2 Promo Credit Entitlement (Subscription Bonus)

Example:

- Customer purchases a mid-tier subscription
- Subscription includes a promo entitlement: **BONUS 10 credits**

Policy:

- Promo credits are a **capability-driven entitlement grant** tied to subscription purchase/renewal.
- Promo grants create **unlocked credits** (spendable entitlements), not locked credits.
- Until Credits exists, the system must represent promo grants as explicit, auditable entitlement records (never silent adjustments).

Promo grants must:

- be idempotent (one grant per qualifying period)
- be auditable
- be reversible if subscription is refunded/voided

---

## 12. Audit Events (Canonical)

Every meaningful state transition or exception emits an event.

### 12.1 Ordering Events

- `ORDER_DRAFT_CREATED`
- `ORDER_DRAFT_UPDATED`
- `ORDER_CONFIRMED`
- `ORDER_LOCKED`
- `ORDER_FULFILLED`
- `ORDER_CANCELLED`

### 12.2 Preset & Override Events

- `PRESET_PREVIEW_GENERATED` (optional, non-canonical)
- `PRESET_RESOLVED`
- `ORDER_OVERRIDE_APPLIED`

### 12.3 Exception Events

- `ORDER_LATE_ACCEPTED`
- `ORDER_EXCEPTION_APPLIED`
- `ORDER_PACK_REVERSAL_APPLIED`
- `ORDER_PROMO_ENTITLEMENT_GRANTED`

All events include:

- actor
- request_id / correlation identifiers
- order_id
- account_id
- reason codes where applicable

---

## 13. Data Model (Conceptual)

Ordering will require persistent records for:

- weekly window identity (`week_id`)
- order header (account_id, week_id, status)
- order lines (dish_id, quantity)
- confirmed allocation plan (resolved presets)
- entitlement counters (monthly) or references to Subscription state
- exception records (who/why/when)

Persistent design must align with `balance_kitchen_schema.md` once implemented.

---

## 14. Security & Access Control

Ordering APIs are session-bearing and must:

- be BalanceGuard-wrapped
- enforce surface and role constraints
- validate input
- enforce origin/CSRF where applicable

Resource-level authorization is mandatory:

- customer may only access their own order
- admin/AM access must be explicit and audited

---

## 15. What Ordering Explicitly Forbids

- Ordering without pack balance
- Multiple orders per account per week
- Mid-pack preference application (preference effective date rules remain authoritative)
- Silent entitlement grants
- Unlogged overrides or cancellations
- Lock-time ambiguity (lock is production cutoff)

---

## 16. Final Statement

Ordering exists to deliver a weekly, low-friction experience while preserving:

- the pack-anchored economic model
- subscription capability entitlements
- deterministic preset-driven allocation
- audited exception handling

Any implementation that bypasses these rules is invalid by definition.
