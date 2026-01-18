# packs_module.md — Packs (Meal Pack Products) Module
Referenced by balance.md
> Canonical module specification for **Packs** in Balance Kitchen (BK).
>
> **Scope:** Pack product catalogue + pack purchases (entitlements).
>
> **This module must align with:**
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

Per `balance_kitchen_schema.md`:

### 2.1 `packs_packs`
Catalog of purchasable pack products.

Columns:
- `id` (uuid, pk)
- `name` (text)
- `description` (text, nullable)
- `meals_included` (integer)
- `price_cents` (integer)
- `currency` (text, default `AUD`)
- `status` (text) — `ACTIVE` | `INACTIVE`
- `created_at`, `updated_at`

### 2.2 `packs_purchases`
Tracks purchase of packs by accounts.

Columns:
- `id` (uuid, pk)
- `account_id` (uuid, fk)
- `pack_id` (uuid, fk)
- `transaction_id` (uuid, nullable, fk → `billing_transactions.id`)
- `status` (text) — `PENDING` | `PAID` | `CANCELLED` | `REFUNDED`
- `meals_granted` (integer)
- `created_at`, `updated_at`

### 2.3 `packs_events`
Event log for pack lifecycle.

Columns:
- `id` (uuid, pk)
- `account_id` (uuid)
- `purchase_id` (uuid)
- `type` (text)
- `payload` (jsonb, nullable)
- `request_id` (uuid, nullable)
- `created_at` (timestamptz)

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

### 4.2 `recordPackPurchasePaidFromWebhook`

Triggered by Billing webhook handling.

Input:
- `account_id`
- `purchase_id`
- `transaction_id`

Responsibilities:
- Set `packs_purchases.status=PAID`
- Emit `packs_events` entry (`PACK_PURCHASE_PAID`)
- Grant meals into Credits ledger (if Credits module is live), referencing purchase/transaction

### 4.3 `recordPackRefundedFromWebhook`

Input:
- `purchase_id` / `transaction_id`

Responsibilities:
- Set `packs_purchases.status=REFUNDED`
- Emit `packs_events` entry (`PACK_PURCHASE_REFUNDED`)
- Reverse entitlement via Credits ledger (if Credits module is live)

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

