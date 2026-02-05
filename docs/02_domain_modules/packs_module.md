# packs_module.md — Packs (Meal Pack Products) Module

Referenced by balance.md
> Canonical module specification for **Packs** in Balance Kitchen (BK).
>
> **Scope:** Pack product catalogue + pack purchases (entitlements).
>
> **This module must align with:**
>
> - `balance_kitchen_architecture.md` (DDD boundaries, thin transports, shared-only cross-cutting)
> - `balance_kitchen_schema.md` (tables + canonical fields)
> - `balanceguard.md` (route security contract)
> - `balance_kitchen_toolkit.md` (component + shared placement rules)
>
---

## 0. At a Glance

- **Purpose:** Allow clients to purchase **meal packs** (one-off products) and receive an entitlement (meals granted).
- **Surfaces:**
  - **client**: initiate checkout + view pack purchases
  - **admin**: manage pack catalogue (create/update/activate/deactivate)
- **Provider:** Stripe Checkout (one-off) via Billing module + Stripe webhooks.
- **Source of truth for persistence:** `packs_packs`, `packs_purchases`, `packs_events` (see schema).

---

## 1. Domain Boundaries

### 1.1 What Packs owns

- Pack product catalogue (name, meals included, price, status)
- Pack purchase records for an account
- Pack lifecycle events for audit/debug

### 1.2 What Packs does NOT own

- Payment processing logic (Stripe) → **Billing module**
- Subscription recurring entitlements → **Subscriptions module**
- Ongoing credit balances → **Credits module** (packs can grant meals to credits, but Credits owns the ledger)

---

## 2. Data Model (Canonical)

Per `balance_kitchen_schema.md` (Packs section):

### 2.1 `pack_products`

Catalog of pack SKUs (authoritative product definition).

### 2.2 `packs`

Customer-owned packs (economic anchor).

Locked rules:

- `meals_remaining >= 0`
- `locked_credits_remaining >= 0`
- v1 invariant: `locked_credits_remaining = meals_remaining`

### 2.3 `pack_events` (append-only)

All pack state changes MUST emit a `pack_events` row.
No silent adjustments.

---

## 3. Public API (Transport Layer)

> **Rule:** Transports are thin adapters only (parse input → BalanceGuard → call use-case → return response).

### 3.1 Client routes

#### POST `/api/v1/client/packs/checkout`

Initiate a Stripe Checkout session for a pack purchase.

- **Auth:** required (`client` role)
- **Origin:** required
- **CSRF:** required
- **Rate limit:** required and stable (e.g., `auth:ip:${ip}::path:${path}`)
- **Body:** `{ pack_id, success_url, cancel_url }`

**Return URL validation (Mandatory):**

- `success_url` and `cancel_url` MUST be validated by allowlist (see `billing_module.md`).
- Must resolve to the **client surface** origin only.
- If invalid: reject with `400 VALIDATION_FAILED`.

Response:

- `200`: `{ checkout_url: string }` (preferred)

#### GET `/api/v1/client/packs`

List active pack catalogue.

- **Auth:** required (client)
- **Origin:** required
- **CSRF:** not required (safe method)

#### GET `/api/v1/client/packs/purchases`

List pack purchases for the client’s account.

- **Auth:** required (client)
- **Origin:** required

### 3.2 Admin routes

#### POST `/api/v1/admin/packs`

Create a pack product.

#### PATCH `/api/v1/admin/packs/:id`

Update pack.

#### POST `/api/v1/admin/packs/:id/activate`

Set status ACTIVE.

#### POST `/api/v1/admin/packs/:id/deactivate`

Set status INACTIVE.

Admin routes must use stricter RBAC and limits.

---

## 4. Application Layer (Use-cases)

### 4.1 `createPackCheckoutSession`

Idempotency (Mandatory):

- Checkout creation must accept an `idempotency_key` (opaque string).
- If a matching in-flight checkout already exists (same account, same pack_product, same short time window),
  return the original `checkout_url`.
- The idempotency key MUST be validated and persisted in the Billing flow (preferred) or Packs (acceptable),
  but must not be “in-memory only”.

Locked rules:

- `idempotency_key` MUST be scoped to `(account_id, surface, operation)` and stored.
- Duplicate `idempotency_key` MUST return the original `{ checkout_url }` (no new purchase, no new session).
- Day-bucket heuristics are forbidden (they allow duplicate charges and duplicate entitlements).

Input:

- `actor` (client)
- `pack_id`
- `success_url`, `cancel_url`

Responsibilities:

- Validate pack exists and is `ACTIVE`
- Create a `packs_purchases` record with `status=PENDING` and `meals_granted=pack.meals_included`
- Call Billing/Stripe to create a Checkout Session (one-off)
- Persist Stripe references on the **billing transaction** (not packs) when available
- Return `checkout_url`

Ordering of operations (Mandatory):

1) Create `packs_purchases` (status=PENDING) first.
2) Create Stripe Checkout Session using a Billing idempotency key derived from `purchase_id`.
3) Persist provider references (checkout_session_id / payment_intent_id) against Billing transaction records.
4) Return checkout URL.

Rule:

- Packs MUST never create a Checkout Session without a persisted `purchase_id`.

### 4.2 `recordPackPurchasedFromWebhook`

Triggered by Billing (after signature + idempotency claim).

Responsibilities:

- Create a new `packs` row for the account:
  - `status=ACTIVE`
  - `meals_remaining = pack_products.meals_total`
  - `locked_credits_remaining = meals_remaining` (v1 invariant)
  - `purchased_at = occurred_at` (from billing transaction)
- Emit `pack_events`:
  - `PACK_PURCHASED` with positive deltas

### 4.3 `consumePackForOrderConfirmation`

Triggered by Ordering confirm (not webhooks).

Responsibilities:

- Decrement `packs.meals_remaining` (and locked credits) atomically
- Emit `pack_events`:
  - `PACK_CONSUMED` (delta negative)
  - `PACK_EXHAUSTED` when it hits zero
- Must be idempotent and concurrency-safe (see Ordering authority boundaries)

---

## 5. Stripe + Billing Integration

### 5.1 Checkout creation

Packs should use **Stripe Checkout (one-time payment)**. The Checkout Session should include:

- `mode=payment`
- `line_items` referencing Stripe `price` (recommended once Stripe is authoritative)
- `metadata`:
  - `bk_purchase_id`
  - `bk_account_id`
  - `bk_pack_id`

> Prefer using Stripe Prices for canonical pricing. If you keep `price_cents` in DB as well, it must match Stripe configuration and be treated as display-only.

### 5.2 Webhook reconciliation

Stripe webhook event types to handle for packs:

- `checkout.session.completed` (payment success)
- `charge.refunded` (refund)

Webhook route must:

- Read raw body (`req.text()`)
- Verify signature with `STRIPE_WEBHOOK_SECRET_BILLING`
- Deduplicate by `event.id` in `billing_stripe_events`

Packs module handlers are called from Billing’s webhook use-case after a transaction is created/updated.

---

## 6. Security & Compliance

### 6.1 BalanceGuard requirements

For all HTTP routes:

- BalanceGuard wrapper is mandatory
- No PII in logs
- Rate limits mandatory

For client checkout:

- `auth.required=true`
- `auth.roles=["client"]`
- `origin.required=true`
- `csrf.required=true`

For webhooks:

- `auth.required=false`
- `origin.required=false`
- `csrf.required=false`
- Rate-limit per `public:ip + path`
- Signature verification is the primary trust gate

### 6.2 Auditability

- Every meaningful state change should emit a `packs_events` row.
- Include `request_id` when the change is triggered by an HTTP request.
- Webhook-driven changes can store Billing’s `requestId` (from BalanceGuard ctx).

---

## 7. Testing (Required)

Tests live under `/tests/**`.

Minimum coverage:

- `createPackCheckoutSession`
  - rejects inactive pack
  - creates `packs_purchases` with `PENDING`
  - returns checkout URL

- Webhook reconciliation integration:
  - duplicate `event.id` is a no-op
  - `checkout.session.completed` marks purchase `PAID`

- Route adapters:
  - client checkout requires auth + origin + csrf
  - rate limit applies

---

## 8. Implementation Notes

- **Router registration** uses `router.register(method, path, handler)` (no `.post()` helpers).
- `json(...)` helper in this repo is `json(status: number, body: unknown)`.
- Use `ctx.requestId` (camelCase) from BalanceGuard context.
- RateLimit key is a function: `(ctx) => string`.

---

## 9. Open Questions (defer until build phase)

- Should Credits be the canonical entitlement store immediately, or should Packs directly expose remaining meals?
- Do we treat `price_cents` as authoritative, or Stripe Price as authoritative?
- Do we support promo codes / coupons for packs in v1?
