# billing_module.md — Billing (Stripe Integration Core) Module

Referenced by balance.md
> Canonical module specification for **Billing** in Balance Kitchen (BK).
>
> **Purpose:** Provide a single, auditable, provider-integrated billing core for:
>
> - **Pack purchases** (one-off)
> - **Subscriptions** (recurring)
> - (Future) **Credits top-ups**, refunds, adjustments
>
> Billing is the **only module that speaks to Stripe**.
> Packs and Subscriptions own their domain meaning and state, and integrate via Billing’s neutral transaction/event outputs.
>
> **This module must align with:**
>
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
- `billing_customers`
- `billing_events`            ← (webhook idempotency + audit)
- `billing_transactions`
- `billing_line_items`  

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
- Persistent idempotency / dedupe (`billing_events`)
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

Per `balance_kitchen_schema.md` (Billing section):

### 3.1 `billing_customers`

Maps internal `account_id` to `stripe_customer_id`.

Authority:

- Billing is the only writer.
- Packs/Subscriptions read via Billing use-cases (never direct Stripe calls).

### 3.2 `billing_events` (Webhook idempotency + audit)

Stores Stripe webhook deliveries for idempotency and audit.

Locked rules:

- Unique on `stripe_event_id`
- Store safe/necessary payload only (see §7.2)
- Track processing state:
  - `RECEIVED` → `PROCESSED` | `FAILED`

### 3.3 `billing_transactions` (Canonical billing facts)

Billing transactions are provider-derived facts (charge/refund/adjustment),
keyed uniquely by `(stripe_object_type, stripe_object_id, kind)`.

Locked rules:

- Billing is authoritative for money facts.
- Domain meaning (pack/subscription/credits) is derived using correlation metadata and dispatched to owning modules.

---

## 4. Public API (Transport Layer)

> **Rule:** HTTP routes are thin adapters only.
> They MUST wrap in BalanceGuard and call application use-cases.

### 4.1 Webhook route

#### POST `/webhooks/stripe/billing`

Responsibilities:

- Read raw body (`req.text()`)
- Verify Stripe signature (`stripe-signature` + signing secret)
- Dedupe by `event.id` in `billing_events` (unique `stripe_event_id`)
- Route event to Billing webhook use-case

Event allowlist (Mandatory):

- Billing MUST maintain a strict allowlist of Stripe event types it will process.
- Unknown event types MUST:
  - be recorded in `billing_events` as `RECEIVED` then `PROCESSED` (no-op),
  - emit `stripe.webhook.ignored` log (safe metadata only),
  - return `200` to Stripe.

Strict parsing (Mandatory):

- Billing MUST treat all Stripe object fields as untrusted input.
- Never assume expansions exist.
- Never assume nested objects are present; handle missing fields deterministically.

### Livemode / environment guard (Mandatory)

Billing MUST enforce environment consistency:

- In production, reject (record as FAILED) any event where `livemode=false`.
- In non-production, you may accept both, but MUST label logs and stored events clearly.

Policy:

- Always return `200` to Stripe once recorded (to stop retries),
  but set `billing_events.process_status=FAILED` with `failure_reason="LIVEMODE_MISMATCH"`.

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

### 4.3 Admin diagnostics (Optional, strict)

If Billing exposes admin diagnostics:

- Must be `admin` surface only (BalanceGuard auth + origin + csrf).
- Must never return Stripe secrets, raw webhook payloads, or full provider objects.
- Must return only:
  - billing_transaction summaries
  - event processing status
  - safe provider ids (e.g. `pi_...`, `in_...`, `sub_...`)

### 4.4 Return URL hardening (Mandatory)

Any user-supplied `success_url` / `cancel_url` (from Packs/Subscriptions checkout initiation)
MUST be validated as a safe return URL.

Rules (locked):

- Only allow https URLs in production.
- Host MUST be allowlisted per-surface (e.g. `client.<domain>`, `admin.<domain>` if ever used).
- Path MUST be relative-safe (no `//` ambiguity); querystring allowed.
- Never allow arbitrary external domains.
- If validation fails: return `400 VALIDATION_FAILED` (safe details).

Rationale:
Prevents open-redirect attacks and “checkout bounce” phishing.

---

## 5. Application Layer (Use-cases)

### 5.1 `handleStripeBillingWebhook`

Input:

- `event: Stripe.Event`
- `requestId: string`

Responsibilities:

1. Claim idempotency (`billing_events` insert)
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

### 5.1.0 Transaction boundary (Mandatory)

Webhook processing MUST be executed within a single DB transaction where possible:

- Insert/claim `billing_events` (idempotency claim)
- Persist derived billing facts (`billing_transactions`, `billing_line_items`, refunds)
- Dispatch to domain handlers (Packs/Subscriptions) which must also write within the same transaction
  OR must be designed to be independently idempotent if dispatched outside.

Finally:

- mark `billing_events` as `PROCESSED` or `FAILED`

Rule:

- Never mark `PROCESSED` unless all required writes and downstream domain updates have completed.

### 5.1.1 Out-of-order & retry semantics (Mandatory)

Stripe events may arrive:

- out of order
- duplicated
- retried after timeouts
- with provider objects missing expected expansions

Rules (locked):

- Billing must be safe to replay the same `event.id` (no double side effects).
- Domain side effects must be conditional on current persisted state
  (e.g., do not mark a purchase PAID twice; do not grant entitlements twice).
- If a required BK correlation reference is missing:
  - mark the stripe event `FAILED`
  - emit `stripe.webhook.failed` log with safe reason
  - return `200` to Stripe (to prevent infinite retries), unless you deliberately want retries.

Return codes (Locked):

- Billing SHOULD return `200` to Stripe once the event is durably recorded in `billing_events`
  (delivery acknowledgement).
- Business success/failure is tracked in `billing_events.process_status`.
- For non-recoverable correlation failures, set `FAILED`, log safe reason, still return `200`
  to prevent infinite retries (unless you explicitly want Stripe retries for that case).

### 5.2 `createStripeCheckoutSessionForPack`

Input:

- `account_id`
- `pack_purchase_id`
- `provider_price_id` OR `price_data`
- `success_url`, `cancel_url`

Output:

- `{ checkout_url }` (preferred)

Idempotency (Mandatory):

- Stripe API calls that create resources (Checkout Sessions, refunds) MUST use a BK-generated idempotency key.
- Key format must be stable and low-cardinality, e.g.:
  - `bk:pack_checkout:<pack_purchase_id>`
  - `bk:sub_checkout:<subscription_id>`
  - `bk:refund:<billing_transaction_id>:<refund_id>`
- If the same call is retried, Billing must return the original resource (checkout_url/refund status).

### 5.3 `createStripeCheckoutSessionForSubscription`

Input:

- `account_id`
- `subscription_id`
- `provider_plan_id` (Stripe `price_...`)
- `success_url`, `cancel_url`

Output:

- `{ checkout_url }`

> These can remain Billing-internal helpers if Packs/Subscriptions own the public use-case.

Idempotency (Mandatory):

- Stripe API calls that create resources (Checkout Sessions, refunds) MUST use a BK-generated idempotency key.
- Key format must be stable and low-cardinality, e.g.:
  - `bk:pack_checkout:<pack_purchase_id>`
  - `bk:sub_checkout:<subscription_id>`
  - `bk:refund:<billing_transaction_id>:<refund_id>`
- If the same call is retried, Billing must return the original resource (checkout_url/refund status).

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

### 6.1.1 Correlation metadata must be durable across event types (Locked)

Stripe events often arrive without Checkout Session metadata.
Therefore, Billing MUST ensure correlation keys exist on the provider objects that generate follow-on events:

- For subscription flows:
  - Copy BK IDs into `subscription_data.metadata` during Checkout creation
  - So `invoice.*` and `customer.subscription.*` remain correlatable

- For pack flows:
  - Include BK IDs in Checkout Session metadata
  - Use billing_events payload parsing to recover BK IDs on `checkout.session.completed`

Mandatory correlation keys (by flow):

- `bk_account_id` (uuid)
- `bk_subscription_id` (uuid) for subscriptions
- `bk_pack_id` (uuid) and/or `bk_pack_product_id` (uuid) for pack purchase mapping (see Packs section)
- optional: `bk_request_id` (uuid) for traceability (never used as authority)

Verification (fail-closed):

- All BK IDs must parse as UUIDs
- Referenced BK records must exist
- Records must belong to the referenced `account_id`
- Cross-account correlation is invalid even if Stripe data “looks valid”

### 6.1.2 Provider object integrity (Mandatory)

### Price / plan allowlist source (Locked)

Billing MUST validate Stripe `price_id` against BK-controlled allowlists:

- Pack checkout: Stripe `price_id` must map to an ACTIVE `pack_products.sku` (or an explicit mapping table).
- Subscription checkout: Stripe `price_id` must match `subscription_plans.provider_plan_id`.

Deny-by-default:

- If the `price_id` is unknown or inactive → mark FAILED, no dispatch.

For money-moving events (checkout completion, invoice paid, refunds), Billing MUST verify:

- Currency is expected (BK v1: `AUD` only unless explicitly expanded).
- The Stripe `price_id` / `line_items` correspond to a BK-known product/plan mapping
  (deny-by-default; no “accept any price from Stripe”).
- Amounts are non-negative and in minor units.
- For subscriptions:
  - invoice belongs to the expected `provider_subscription_id`
  - subscription belongs to the expected `provider_customer_id` (when known)

If any integrity check fails:

- mark event `FAILED`
- do not dispatch to Packs/Subscriptions
- log `stripe.webhook.failed` with safe reason (no PII)

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

### 7.2.1 Payload retention policy (Mandatory)

Even though the schema defines `billing_events.payload_json`, Billing MUST treat it as sensitive:

- Never log raw payloads or the `stripe-signature` header
- Prefer storing a **minimised payload**:
  - event id/type/livemode/created
  - primary Stripe object ids used for correlation (session/invoice/subscription/charge/payment_intent/customer)
  - BK correlation metadata only (UUIDs)
- If full payload retention is required for debugging:
  - restrict access operationally (DB roles)
  - consider encrypting the JSON at rest in application code before insert

### 7.3 Correlation integrity (Mandatory)

For any event that drives domain state, Billing MUST:

- require BK correlation metadata fields (per event type)
- verify they parse as UUIDs
- verify referenced records exist (account/subscription/purchase)
- verify the record belongs to the referenced account_id
- refuse cross-account correlation even if Stripe data “looks valid”

If correlation fails:

- set Stripe event status `FAILED`
- do not dispatch to domain modules

### 7.4 Observability

- Include `requestId` in all logs
- Log only high-level events:
  - `stripe.webhook.received`
  - `stripe.webhook.duplicate`
  - `stripe.webhook.processed`
  - `stripe.webhook.failed`

---

## 8. Folder & File Structure (Canonical)

Billing’s canonical file layout is defined in:

- `billing_folder_structure.md`

**Locked rule:**

- Any PR that **adds/removes/renames** a Billing file MUST update:
  1) `billing_folder_structure.md`, and
  2) this section in `billing_module.md`.

If Billing code layout and the folder-structure doc disagree, the folder-structure doc wins until intentionally revised.

**Boundary reminder:**

- `domain/` must not import DB or Stripe SDK.
- `transport/` must be thin (BalanceGuard → parse → call use-case → respond).
- Stripe SDK usage is Billing-only; shared Stripe helpers (if any) must remain generic.

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
