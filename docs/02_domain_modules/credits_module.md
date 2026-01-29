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

Each credit entry must include:

- `credit_entry_id`
- `account_id`
- `credit_class` (locked | unlocked)
- `amount` (positive or negative)
- `source` (pack, subscription, refund, admin, system, gamification)
- `reference_type` (order, pack, subscription, refund, etc.)
- `reference_id`
- `created_at`
- `expires_at?`

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
