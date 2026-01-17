# billing_module.md — Billing (Stripe Integration Core) Module
Referenced by balance.md
> Canonical module specification for **Billing** in Balance Kitchen (BK).
>
> **Purpose:** Provide a single, auditable, provider-integrated billing core for:
> - **Pack purchases** (one-off)
> - **Subscriptions** (recurring)
> - (Future) **Credits top-ups**, refunds, adjustments
>
> Billing is the **only module that speaks to Stripe**.
> Packs and Subscriptions own their domain meaning and state, and integrate via Billing’s neutral transaction/event outputs.
>
> **This module must align with:**
> - `balance.md` (system intent + surfaces)
> - `balance_kitchen_business_model.md` (packs/subscriptions purchase flows)
> - `balance_kitchen_architecture.md` (DDD boundaries, thin transports)
> - `balance_kitchen_schema.md` (billing tables + relationships)
> - `balanceguard.md` (security, idempotency, normalized errors)
> - `balance_kitchen_toolkit.md` (shared placement rules)
>
---

## 0. At a Glance

- **Billing owns:** Stripe SDK, webhook verification, idempotency, billing transactions + line items.
- **Billing does not own:** what a pack/subscription *means*; entitlements; UI.
- **Primary surfaces:**
  - **webhooks**: `/webhooks/stripe/billing`
  - **client**: checkout session creation endpoints (often called via Packs/Subscriptions routes)
  - **admin**: (optional) billing diagnostics, refund initiation
- **Primary persistence:**
  - `billing_transactions`
  - `billing_line_items`
  - `billing_stripe_events`
  - `billing_refunds` (if enabled)

---

## 1. Business Integration Overview

### 1.1 How Billing integrates Packs + Subscriptions

Billing is the **payment and reconciliation hub**.

- **Packs module** owns:
  - Pack catalogue + pack purchase records + pack entitlement logic
  - `packs_module.md`

- **Subscriptions module** owns:
  - Plan catalogue + subscription state machine + subscription events
  - `subscriptions_module.md`

- **Billing module** owns:
  - Stripe Checkout session creation
  - Webhook signature verification
  - Event idempotency + processing state
  - Normalised transaction ledger

> In the BK business model, clients must purchase either a **Pack** or **Subscription** before ordering meals.
> Billing is the payment rail that enables that prerequisite.

---

## 2. Domain Boundaries

### 2.1 What Billing owns

- Provider clients (Stripe SDK initialization)
- Checkout session creation (payment + subscription modes)
- Webhook verification and event routing
- Persistent idempotency / dedupe (`billing_stripe_events`)
- Normalised transactions (`billing_transactions`) and breakdown (`billing_line_items`)
- Refund capture/recording (optional)

### 2.2 What Billing does NOT own

- Pack business rules / meal entitlements → Packs
- Subscription status machine + plan rules → Subscriptions
- Meal credit balances / ledger → Credits (future)
- Delivery, menus, ordering → Delivery/Ordering modules
- UI concerns → Site/Client/Admin frontends

---

## 3. Data Model (Canonical)

Per `balance_kitchen_schema.md` (billing section):

### 3.1 `billing_stripe_events`
Stores Stripe webhook deliveries for idempotency and audit.

Key rules:
- Unique on `stripe_event_id`
- Store minimal/redacted payload only if required
- Track `status`: `RECEIVED` → `PROCESSED` | `FAILED`

Implementation note:
- `billing_stripe_events.status` is a typed enum:
  - `RECEIVED` | `PROCESSED` | `FAILED`

### 3.2 `billing_transactions`
Canonical ledger of monetary transactions.

Typical transaction kinds:
- `PACK_PURCHASE`
- `SUBSCRIPTION_PAYMENT`
- (future) `CREDITS_TOPUP`
- `REFUND`

Must store:
- amount, currency
- provider object ids: checkout session id, payment intent id, invoice id, charge id
- references to `account_id`
- `request_id` where applicable

### 3.3 `billing_line_items`
Breakdown per transaction.

Line item types:
- `PACK`
- `SUBSCRIPTION`
- `CREDIT`

### 3.4 `billing_refunds` (optional)
If you support refunds, record them separately and link to the transaction.

### 3.5 Billing (Stripe Integration Core)
**Spec:** `billing_module.md`

- Stripe SDK integration
- Webhook verification and idempotency (Stripe Event `id` claimed in `billing_stripe_events`)
- Canonical transaction ledger
- Dispatch of billing facts to domain modules

Billing is the **only module** permitted to communicate with Stripe.


---

## 4. Public API (Transport Layer)

> **Rule:** HTTP routes are thin adapters only.
> They MUST wrap in BalanceGuard and call application use-cases.

### 4.1 Webhook route

#### POST `/webhooks/stripe/billing`

Responsibilities:
- Read raw body (`req.text()`)
- Verify Stripe signature (`stripe-signature` + signing secret)
- Dedupe by `event.id` in `billing_stripe_events`
- Route event to Billing webhook use-case

Security posture:
- `auth.required=false`
- `origin.required=false`
- `csrf.required=false`
- rate limit keyed by `public:ip + path`
- DO NOT apply browser CORS assumptions

### 4.2 Checkout creation routes (internal to client surface)

Billing can expose provider-neutral checkout creation use-cases which are invoked by Packs/Subscriptions routes.

Recommended transport approach:
- Packs route: `POST /api/v1/client/packs/checkout` calls `createPackCheckoutSession` (Packs use-case) which calls Billing provider adapter.
- Subscriptions route: `POST /api/v1/client/subscriptions/checkout` calls `createSubscriptionCheckoutSession` (Subscriptions use-case) which calls Billing provider adapter.

Billing should NOT own the client route semantics for pack/subscription selection; it can provide reusable helpers.

---

## 5. Application Layer (Use-cases)

### 5.1 `handleStripeBillingWebhook`

Input:
- `event: Stripe.Event`
- `requestId: string`

Responsibilities:
1. Claim idempotency (`billing_stripe_events` insert)
2. If duplicate → return `{ received: true }`
3. Route known event types to domain-specific handlers:
   - Subscriptions:
     - `recordCheckoutSessionCompletedUseCase`
     - `recordInvoicePaidUseCase`
     - `recordInvoicePaymentFailedUseCase`
     - `recordProviderSubscriptionUpdatedUseCase`
   - Packs (future)
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `charge.refunded`
4. Persist billing idempotency + processing state
5. Mark Stripe event `PROCESSED` or `FAILED`
6. Mark event processed or failed

Idempotency rules:
- Never apply side effects twice for the same `event.id`
- Processing should be safe for retries

### 5.2 `createStripeCheckoutSessionForPack`

Input:
- `account_id`
- `pack_purchase_id`
- `provider_price_id` OR `price_data`
- `success_url`, `cancel_url`

Output:
- `{ checkout_url }` (preferred)

### 5.3 `createStripeCheckoutSessionForSubscription`

Input:
- `account_id`
- `subscription_id`
- `provider_plan_id` (Stripe `price_...`)
- `success_url`, `cancel_url`

Output:
- `{ checkout_url }`

> These can remain Billing-internal helpers if Packs/Subscriptions own the public use-case.

---

## 6. Event Routing Contract (Integration With Packs + Subscriptions)

> Billing emits **neutral billing facts**, then asks domain modules to apply meaning.

### 6.1 Required metadata strategy

Billing relies on identifiers to correlate Stripe objects to BK records.

When creating Checkout Sessions, include Stripe metadata:

- `bk_account_id`
- `bk_pack_purchase_id` (for packs)
- `bk_subscription_id` (for subscriptions)
- `bk_plan_id`

This allows webhook handlers to:
- locate the correct domain records
- apply state transitions

### 6.2 Packs integration

On `checkout.session.completed` (mode=payment):
- Create `billing_transaction` (`kind=PACK_PURCHASE`, status succeeded)
- Dispatch to Packs:
  - mark `packs_purchases` as `PAID`
  - emit `packs_events`
  - grant entitlements (via Credits if available)

On `charge.refunded`:
- Create `billing_refunds`
- Dispatch to Packs:
  - set purchase `REFUNDED`
  - reverse entitlements

### 6.3 Subscriptions integration

Billing processes Stripe events (signature + idempotency) and then calls Subscriptions webhook use-cases.

On `checkout.session.completed` (mode=subscription):
- Parse Checkout Session
- Require BK correlation metadata:
  - `bk_account_id`
  - `bk_subscription_id`
- Extract:
  - `provider_subscription_id` from `session.subscription`
  - `provider_customer_id` from `session.customer`
- Call Subscriptions:
  - `recordCheckoutSessionCompletedUseCase(...)`

On `invoice.paid`:
- Parse Invoice
- Require BK correlation metadata (v1 deterministic mapping):
  - `bk_account_id`
  - `bk_subscription_id`
- Extract:
  - `provider_invoice_id`, `provider_subscription_id`, `provider_customer_id`
  - amount + currency (minor units)
  - period start/end best-effort (optional)
- Call Subscriptions:
  - `recordInvoicePaidUseCase(...)`

On `invoice.payment_failed`:
- Parse Invoice
- Require BK correlation metadata (v1 deterministic mapping)
- Extract attempt_count / next_payment_attempt best-effort
- Call Subscriptions:
  - `recordInvoicePaymentFailedUseCase(...)`

On `customer.subscription.created` / `customer.subscription.updated`:
- Parse Subscription object
- Require BK correlation metadata (v1 deterministic mapping)
- Extract:
  - provider status, period start/end, cancel_at_period_end, canceled_at
- Call Subscriptions:
  - `recordProviderSubscriptionUpdatedUseCase(...)`

On `customer.subscription.deleted`:
- Same as subscription.updated, but Billing forces:
  - status = `CANCELLED`
  - canceled_at = now (if missing)
- Call Subscriptions:
  - `recordProviderSubscriptionUpdatedUseCase(...)`

---

## 7. Security & Compliance

### 7.1 BalanceGuard requirements

- Every HTTP route is BalanceGuard-wrapped
- Rate limits mandatory
- Security headers applied
- Errors normalized with request id

### 7.2 Webhook-specific controls

- Verify Stripe signature on raw body
- Dedupe by `event.id`
- Never log raw body or `stripe-signature`
- Store only redacted event details when necessary

### 7.3 Observability

- Include `requestId` in all logs
- Log only high-level events:
  - `stripe.webhook.received`
  - `stripe.webhook.duplicate`
  - `stripe.webhook.processed`
  - `stripe.webhook.failed`

---

## 8. Folder Structure (Recommended)

```text
src/modules/billing/
  domain/
  application/
  infrastructure/
    stripe/
    db/
  transport/http/

src/shared/stripe/
  stripe-client.ts
  webhook.ts
  idempotency.ts
  events.ts
```

Notes:
- `src/shared/stripe/*` is shared cross-cutting infrastructure.
- Billing owns provider-specific mapping.
- Packs/Subscriptions own their use-cases + state changes.

---

## 9. Testing (Required)

All tests under `/tests/**`.

Minimum:

- Webhook signature verification:
  - missing header returns normalized 400
  - invalid signature returns normalized 400

- Webhook idempotency:
  - same event id processed once, duplicates are no-op 200

- Transaction persistence:
  - inserts billing transaction for pack checkout completion
  - inserts billing transaction for invoice.paid

- Dispatch integration:
  - `checkout.session.completed` triggers Packs handler
  - `invoice.paid` triggers Subscriptions handler

---

## 10. Operational Setup

### 10.1 Stripe account configuration

- Create products + prices for packs and subscription plans
- Use Stripe Price IDs as provider pointers:
  - packs: `provider_price_id` (if implemented)
  - subscriptions: `subscriptions_plans.provider_plan_id`

### 10.2 Webhook endpoint

- Configure Stripe webhook endpoint to:
  - POST `/webhooks/stripe/billing`
  - subscribe to required events
  - store signing secret in `STRIPE_WEBHOOK_SECRET_BILLING`

---

## 11. Open Questions (Defer)

- Do we allow promo codes/coupons in v1?
- Do we make Stripe Prices fully authoritative (recommended) vs also storing `price_cents`?
- Do we allow subscription plan upgrades/downgrades (proration policy)?
- Do we support partial refunds and chargebacks in v1?

