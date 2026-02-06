# credits_module.md — Entitlement Ledger (v0.1)

> **Canonical policy specification** for the Balance Kitchen (BK) Credits module.
>
> Credits form the **entitlement ledger** of the platform.
>
> They are not a product feature, a UI reward system, or a replacement for packs.
> They are a **financially relevant accounting primitive** that must remain auditable, deterministic, and corruption‑resistant.

---

## 0. Status & Scope

**Status:** Draft v0.1 (Policy‑Only)

**Scope:**

- Credit semantics and invariants
- Ledger rules (append‑only)
- Credit classes (locked vs unlocked)
- Expiry and reversal policy
- Authority boundaries

**Out of scope (explicit):**

- UI design
- Database schema
- Reward shop implementation
- Gamification mechanics

This document must align with:

- `balance.md`
- `balance_kitchen_business_model.md`
- `ordering_module.md`
- `operational_failure_model.md`
- Billing reconciliation rules

---

## 1. Purpose & Philosophy

Credits exist to:

- Represent **entitlements**, not meals
- Enable refunds, promotions, and future gamification **without compromising packs**
- Preserve a clean separation between **money**, **inventory**, and **rewards**

Credits are intentionally conservative.
They trade novelty for correctness, traceability, and long‑term safety.

---

## 2. What Credits Are (And Are Not)

### 2.1 Credits Are

- An **append‑only ledger** of entitlement events
- The canonical record for:
  - promotional grants
  - refunds and reversals
  - goodwill adjustments
  - future reward systems

### 2.2 Credits Are Not

- A currency
- A wallet
- A meal inventory
- A UI‑driven balance
- A substitute for packs or subscriptions

Credits must never be visually gamified or framed as money.

---

## 3. Credit Classes (Locked Invariant)

Credits are partitioned into **two non‑interchangeable classes**.

### 3.1 Locked Credits

**Definition:**
Credits that are **pack‑backed** and represent the internal accounting of a purchased pack.

**Properties:**

- Created when a pack is purchased
- Tied directly to pack quantity
- **Consumable only by packs**
- Not spendable in reward systems
- Not visible as a global balance

**Expiry:**

- Locked credits expire when the associated pack reaches **zero meals**

**Rule:**
> Only packs may consume locked credits.

---

### 3.2 Unlocked Credits

**Definition:**
Credits that are **spendable entitlements**.

**Properties:**

- Created via promotions, refunds, goodwill, or gamification
- May be exchanged for reward‑shop items (future)
- Visible to customers in the dashboard header

**Expiry:**

- All earned/unlocked credits expire after **12 months** unless explicitly stated otherwise

**Rule:**
> Unlocked credits may never be silently derived from locked credits.

---

## 4. Credit Unlocking (Future‑Facing Policy)

The platform may support **credit unlocking** as a deliberate user action.

**Unlocking semantics:**

- A user elects to convert part of a pack into unlocked credits
- This action:
  - decrements pack meal count
  - creates corresponding unlocked credit ledger entries

**Rules:**

- Unlocking is explicit and user‑initiated
- Unlocking is irreversible
- Unlocking must be auditable

Unlocking does not bypass pack economics; it transforms them.

---

## 5. Ledger Model (Canonical)

Credits use a **ledger model**, not a mutable balance.

### 5.1 Append‑Only Rule

- Credit entries are **never mutated or deleted**
- Adjustments are represented by new entries
- Balance is a **projection**, not stored state

### 5.2 Conceptual Ledger Fields

Each credit entry MUST include (schema-aligned):

- `id` (uuid)
- `request_id` (uuid)
- `account_id` (uuid)
- `credit_class` (`LOCKED` | `UNLOCKED`)
- `amount` (int; positive grant, negative consume/reversal)
- `source` (`PACK` | `SUBSCRIPTION_PROMO` | `REFUND` | `ADMIN` | `SYSTEM` | `GAMIFICATION`)
- `reference_type` (text)
- `reference_id` (uuid)
- `expires_at?` (timestamptz)

Additionally required for safety (schema should add):

- `idempotency_key text not null`

Locked constraint:

- unique (`account_id`, `idempotency_key`)

---

## 6. Credit Sources (Authoritative)

Credits may be created **only** by approved sources.

### 6.1 Allowed Sources

- Pack purchase (locked credits)
- Subscription promotional entitlements
- Billing refunds
- Admin goodwill adjustments
- Gamification rewards (future)

### 6.2 Forbidden Sources

- UI actions without server validation
- Implicit adjustments
- AM verbal promises
- Silent compensation

Any credit entry without a source is invalid by definition.

---

## 7. Credit Consumption Rules

### 7.1 Consumption Eligibility

**Locked credits:**

- Represent meal value
- Are **consumed by Ordering** when meals are ordered
- Decrement implicitly as pack meals are consumed
- Are the **only credits that may purchase meals**

**Unlocked credits:**

- Are **never consumed by Ordering** for meals
- Are consumable **only** by reward-shop items or vouchers (future)

**Invariant:**
> Credits do not directly purchase meals **except** via locked credits being consumed through packs.

#### 7.1.1 Locked credit consumption representation (Mandatory)

Even if packs expose a “meal count” UI, the canonical accounting MUST be representable as ledger consumption.

Rules:

- When Ordering consumes a meal backed by a pack, the system MUST record a corresponding
  locked-credit consumption entry (or an equivalent auditable pack-consumption event that can be reconciled).
- Consumption entries MUST:
  - reference the order (reference_type=`order`, reference_id=`order_id`)
  - be idempotent per ordered line item (see 10.3)
- Consumption must never touch unlocked credits.

### 7.2 Credit Conversion (Locked → Unlocked)

Locked credits may be **explicitly unlocked** as a deliberate action.

**Conversion semantics:**

- Conversion is **one-way only**: locked → unlocked
- Unlocking:
  - decrements pack meal count
  - creates corresponding unlocked credit ledger entries
- Unlocking is irreversible

**Forbidden:**

- Unlocked credits can **never** be converted back into locked credits
- No automatic or implicit unlocking is allowed

**One-way rule (locked):**

- Locked credits may be unlocked.
- Unlocked credits can never become locked credits.

---

## 8. Expiry & Projection Rules

- Expired credits remain in the ledger
- Expired credits are non‑consumable
- Expiry must not retroactively affect prior usage

Balance projections must:

- Exclude expired credits
- Respect class separation

Projection correctness (Mandatory):

- Projections MUST be computed from ledger entries only (no “manual overrides”).
- Projections MUST be reproducible from the same inputs (deterministic).
- Any cached/materialized projection MUST be treated as derived data and re-buildable.
- Class separation is enforced at query time (locked vs unlocked never merge).

---

## 9. Negative Balances & Guardrails

Temporary negative projections are **permitted** under strict controls.

### 9.1 Allowed Scenarios

- Refund disputes
- Operational reversals
- Subscription promo rollback

### 9.2 Guardrails

- Maximum negative threshold (configurable)
- Maximum negative duration (configurable)
- Mandatory admin visibility
- Automatic escalation if thresholds exceeded

Negative balances must never be invisible or unbounded.

---

## 10. Refund & Reversal Semantics

Refunds and reversals are expressed as **new ledger entries**.

### 10.1 Examples

- Subscription refunded → promo credits reversed
- Order cancelled → consumed credits restored

### 10.2 Rules

- Original entries are never deleted
- Reversal entries must reference the original entry
- Reversals must reconcile with Billing where money is involved

### 10.2.1 Billing correlation (Mandatory)

If a credit grant/reversal is money-adjacent (packs, refunds, chargebacks):

- The ledger entry MUST reference a Billing transaction/refund identifier.
- Refund-driven reversals MUST be linked to the original grant via:
  - `reversal_of_entry_id` (or equivalent reference field)
- Money-adjacent reversals MUST fail closed if the Billing reference is missing.

## 10.3 Spend Atomicity & Idempotency (Mandatory)

Any credit consumption MUST be:

- atomic (no partial writes)
- idempotent (safe retries)
- concurrency-safe (double-spend resistant)

Schema requirement (Mandatory):

- `credit_entries` MUST include `idempotency_key` and enforce uniqueness on (`account_id`,`idempotency_key`).
- Without this, double-spend prevention is not enforceable at the DB boundary.

Rules (locked):

- Every consume operation requires an `idempotency_key` (string).
- Ledger entries must include `(account_id, idempotency_key)` with a unique constraint.
- Consumption must fail closed if available unlocked balance is insufficient at commit time.
- No “check-then-write” without transactional protection.

Idempotency key format (Recommended):

- Keys should be stable, human-debuggable strings:
  - `order:<order_id>:consume:<line_item_id>`
  - `reward_shop:<purchase_id>:buy:<item_type>`
  - `pack_purchase:<purchase_id>:grant`
- Keys must never contain secrets or PII.

Rationale:
Prevents double-spends and race-condition entitlement drift, especially under gamification load.

---

## 11. Authority Model

### 11.1 Account Manager (AM)

AMs may:

- Request credit grants or reversals

AMs may NOT:

- Create, reverse, or unlock credits directly

---

### 11.2 Admin

Admins may:

- Approve and apply credit grants
- Execute reversals
- Override guardrails with justification

All admin actions must be auditable.

---

### 11.3 System

The system may:

- Apply deterministic promotional grants
- Apply deterministic reversals

The system may NOT:

- Apply discretionary goodwill credits

---

## 12. Reward Shop Integration (Future)

The Reward Shop is the canonical consumer of **unlocked credits**.

### 12.1 Reward Items (Examples)

- Meal tokens
- Late‑order vouchers
- Cancellation vouchers
- Food items

### 12.2 Rule

- Only unlocked credits may be spent in the Reward Shop
- Purchases issue **items** into an account inventory
- Purchases are non-refundable
- Items are redeemed by Ordering/Operations; credits are not

Credits are exchanged for items.
Items — not credits — interact with Ordering.

---

## 13. Audit Events (Canonical)

Credits must emit structured events, including:

- `CREDIT_GRANTED`
- `CREDIT_UNLOCKED`
- `CREDIT_CONSUMED`
- `CREDIT_REVERSED`
- `CREDIT_EXPIRED`

Events must include:

- actor
- source
- reference
- justification

---

## 14. What Credits Explicitly Forbid

- Balance overwrites
- Class conversion
- Silent expiry
- UI‑driven mutation
- Gamified visual treatment
- Meal purchase via credits
- See `reward_shop_module.md` for item exchange mechanics.

---

## 15. Future‑Safe Guarantees

This model is designed to support:

- Gamification layers
- Reward shops
- Enterprise accounts
- Regulatory audits
- Partial refunds

Without rewriting the ledger or corrupting economics.

---

## 16. Final Statement

Credits are an **accounting truth**, not a feature.

They exist to protect Balance Kitchen from:

- entitlement drift
- refund chaos
- gamification corruption

Any implementation that violates these rules is invalid by definition.
