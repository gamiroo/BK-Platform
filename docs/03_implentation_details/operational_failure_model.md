# operational_failure_model.md — Operational Failure & Exception Handling Policy

> **Canonical operational policy** for Balance Kitchen (BK).
>
> This document defines **how the system, staff, and platform respond to real‑world failures** that occur outside of normal business flow.
>
> It is a **policy document**, not an implementation guide.
>
> All exception handling, overrides, credits, refunds, and communications **must conform** to this model.

---

## 0. Status & Governance

**Status:** Draft v1.0 (Proposed)

**Governs:**

- Kitchen operations
- Ordering exceptions
- Delivery exceptions
- Account Manager (AM) actions
- Credits and refunds (policy only)

**Must align with:**

- `balance.md`
- `balance_kitchen_business_model.md`
- `balance_kitchen_architecture.md`
- `balanceguard.md`

Any change to this document **requires governance notification** per `balance.md`.

---

## 1. Purpose & Philosophy

Operational failures are **inevitable** in a real food business.

Balance Kitchen does **not** treat failures as edge cases.
Instead, failures are treated as **first‑class operational states** with:

- Defined response options
- Clear authority boundaries
- Mandatory auditability
- Customer‑first outcomes without economic leakage

This policy ensures:

- Consistency under pressure
- Fairness to customers
- Protection of economic invariants
- Reduced improvisation by staff

---

## 2. Definition of an Operational Failure

An **operational failure** is any event where Balance Kitchen cannot deliver the expected service **as defined by the current lifecycle state**.

Failures are **not bugs** and **not security incidents**.
They are real‑world disruptions requiring controlled response.

---

## 3. Failure Categories (Canonical)

Every failure **must be classified** into exactly one primary category.

### 3.1 Supply Failure

Examples:

- Ingredient unavailable or spoiled
- Supplier delivery missed or partial
- Menu item cannot be produced safely

Scope:

- Affects one or more dishes
- Does not affect delivery logistics directly

---

### 3.2 Kitchen / Production Failure

Examples:

- Equipment failure
- Power outage
- Staffing shortfall
- Food safety halt

Scope:

- Affects production capacity
- May affect all customers for a cycle

---

### 3.3 Ordering System Failure

Examples:

- Ordering window inaccessible
- Preset resolution failure
- Order confirmation not generated

Scope:

- Digital failure only
- No physical production has begun

---

### 3.4 Delivery Failure

Examples:

- Driver no‑show
- Vehicle breakdown
- Route delay
- Address access issue

Scope:

- Meals exist but cannot be delivered as planned

---

### 3.5 Human / Process Failure

Examples:

- Incorrect manual override
- AM misconfiguration
- Admin operational error

Scope:

- Preventable but non‑malicious

---

### 3.6 Force Majeure

Examples:

- Extreme weather
- Government restrictions
- Natural disasters

Scope:

- Outside reasonable operational control

---

## 4. Allowed Response Types (Policy‑Locked)

Responses are **constrained**. Staff may not invent new response types.

### 4.1 Delay

Definition:

- Fulfilment is postponed

Rules:

- Must communicate revised timing
- Must not consume additional credits
- Must be logged

---

### 4.2 Substitution

Definition:

- A dish or component is replaced

Rules:

- Must respect customer preferences and allergens
- Must not downgrade subscription tier entitlements
- Requires customer consent (explicit or pre‑authorised)

---

### 4.3 Credit

Definition:

- Adjustment to internal entitlement balance

Rules:

- Credits follow `credits_module.md` policy
- Purchased vs earned distinction applies
- Credits must be auditable and reversible

---

### 4.4 Refund

Definition:

- Monetary return via Billing

Rules:

- Refunds always flow through Billing
- Refunds may be partial or full
- Refund events must correlate to original transaction

---

### 4.5 Cancellation (Cycle‑Scoped)

Definition:

- A specific order cycle is cancelled

Rules:

- Packs must not be consumed
- Subscription state must remain valid
- Customer must be notified

---

## 5. Authority Model (Who Can Decide)

### 5.1 Account Manager (AM)

AMs may:

- Apply delays
- Offer substitutions within policy
- Apply **pre‑approved** credits

AMs may NOT:

- Issue refunds
- Modify pack balances directly
- Override subscription pause/cancel rules

All AM actions **must be logged**.

---

### 5.2 Admin

Admins may:

- Approve refunds
- Apply non‑standard credits
- Override AM actions
- Execute force majeure responses

Admins must:

- Provide a reason code
- Trigger audit events

---

### 5.3 System (Automated)

The system may:

- Auto‑pause subscriptions
- Prevent ordering during outages
- Apply deterministic credits

The system may NOT:

- Issue discretionary refunds
- Apply non‑deterministic substitutions

---

## 6. Economic Invariants (Non‑Negotiable)

Failures must **never violate** the following:

- Packs remain the economic anchor
- Subscriptions are active only while packs remain
- Credits are ledger entries, not visual rewards
- Refunds must reconcile against Billing
- No silent entitlement creation

If an action would violate an invariant, it is **not permitted**.

---

## 7. Audit & Observability Requirements

Every operational failure must emit **at least one audit event**.

Canonical events include:

- `OP_FAILURE_RECORDED`
- `OP_RESPONSE_APPLIED`
- `OP_CREDIT_GRANTED`
- `OP_REFUND_ISSUED`
- `OP_OVERRIDE_USED`

Audit events must include:

- Failure category
- Response type
- Actor (AM, admin, system)
- Correlation to order / pack / subscription

---

## 8. Customer Communication Rules

- Communication must be calm and factual
- No urgency language
- No blame assignment
- No technical jargon

Messaging must align with the **relationship‑led model** defined in `balance_kitchen_business_model.md`.

---

## 9. Interaction With Other Modules

| Module | Interaction |
| ------ | ----------- |
| Ordering | Failure detection, cycle cancellation |
| Packs | Credit / consumption protection |
| Subscriptions | Pause / resume validation |
| Billing | Refund execution |
| Notifications | Customer communication |

---

## 10. What This Policy Explicitly Forbids

- Ad‑hoc compensation
- Silent pack adjustments
- Verbal‑only promises
- Unlogged overrides
- Bypassing Billing for refunds

---

## 11. Future Extensions

This policy is designed to support:

- Automated compensation rules
- SLA‑based entitlements
- Enterprise accounts

Any extension must preserve **economic invariants**.

---

## 12. Final Statement

Operational failures are **managed, not improvised**.

This document ensures Balance Kitchen responds to real‑world disruption with:

- Consistency
- Accountability
- Customer trust

All staff, systems, and future automation must conform to this policy.
