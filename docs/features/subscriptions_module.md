
# subscriptions_module.md — Subscriptions (Recurring Meal Plans) Module

Referenced by balance.md
> Canonical module specification for **Subscriptions** in Balance Kitchen (BK).
>
> **Scope:** Subscription plan catalogue + customer subscriptions (recurring), including lifecycle state, billing reconciliation hooks, and entitlement strategy.
>
> **This module must align with:**
>
> - `balance_kitchen_architecture.md` (DDD boundaries, thin transports)
> - `balance_kitchen_schema.md` (tables + canonical fields)
> - `balanceguard.md` (route security contract)
> - `balance_kitchen_toolkit.md` (shared placement rules)

---

## 0. At a Glance

- **Purpose:** Allow clients to subscribe to recurring meal plans (weekly/fortnightly/etc.) and maintain an auditable subscription lifecycle.
- **Surfaces:**
  - **client**: start subscription checkout, view status, manage renewal/cancel, view invoices/transactions
  - **admin**: create/update/activate/deactivate plans; manage a customer’s subscription in exceptional cases
- **Provider:** Stripe Subscriptions (Checkout + webhook reconciliation)
- **Source of truth for payment events:** Billing module + Stripe webhooks
- **Source of truth for subscription state:** Subscriptions module tables
- **Implementation status:** v1 core complete  
(Client checkout, plan management, webhook reconciliation, pause semantics, audit events)

---

## 1. Domain Boundaries

### 1.1 What Subscriptions owns

- Subscription plan catalogue (what plans exist, what they include, their provider plan ids)
- Customer subscription records (status, periods, cancellation/pausing flags)
- Subscription lifecycle events for audit/debug

### 1.2 What Subscriptions does NOT own

- Payment authorization/capture implementation details (Stripe SDK, signature verification) → **Billing module**
- One-off pack purchases → **Packs module**
- Meal balance/credit ledger (if implemented) → **Credits module**

---

## 2. Data Model (Canonical)

Per `balance_kitchen_schema.md`:

### 2.1 `subscriptions_plans`

Catalog of subscription plans.

Columns (typical; align to schema):

- `id` (uuid, pk)
- `name` (text)
- `description` (text, nullable)
- `interval` (text) — e.g. `WEEK` | `FORTNIGHT` | `MONTH`
- `meals_per_interval` (integer)
- `provider_plan_id` (text) — Stripe `price_...` (**authoritative** pointer)
- ⚠️ We do **not** store `price_cents` in BK v1; Stripe Prices are authoritative.
- `currency` (text, default `AUD`)
- `provider` (text, default `stripe`)
- `provider_plan_id` (text) — Stripe `price_...` (authoritative pointer)
- `status` (text) — `ACTIVE` | `INACTIVE`
- `created_at`, `updated_at`

Notes:

- Stripe Prices are authoritative for money amounts; BK can store amounts elsewhere later if needed,
  but v1 uses `provider_plan_id` as the billing pointer.

### 2.2 `subscriptions_subscriptions`

Customer subscriptions.

Columns (typical; align to schema):

- `id` (uuid, pk)
- `account_id` (uuid, fk)
- `plan_id` (uuid, fk)
- `provider` (text)
- `provider_subscription_id` (text) — Stripe `sub_...`
- `status` (text) — `INCOMPLETE` | `ACTIVE` | `PAST_DUE` | `CANCELLED` | `PAUSED`
- `current_period_start` (timestamptz)
- `current_period_end` (timestamptz)
- `cancel_at_period_end` (boolean)
- `canceled_at` (timestamptz, nullable)
- `paused_at` (timestamptz, nullable)
- `resume_at` (timestamptz, nullable)
- `created_at`, `updated_at`

### 2.3 `subscriptions_events`

Audit log for subscription lifecycle.

Columns:

- `id` (uuid, pk)
- `account_id` (uuid)
- `subscription_id` (uuid)
- `type` (text)
- `payload` (jsonb, nullable)
- `request_id` (uuid, nullable)
- `created_at` (timestamptz)

---

## 3. State Machine (Lifecycle)

### 3.1 States

- `INCOMPLETE` — created locally, awaiting successful payment/confirmation
- `ACTIVE` — current period is active
- `PAST_DUE` — invoice payment failed; access may be limited
- `PAUSED` — explicitly paused by Balance Kitchen (client or admin action).
  - Used for non-payment-related pauses (e.g. customer holidays).
  - Payment failures **must not** override PAUSED.
  - Resume may be manual or scheduled.
- `CANCELLED` — ended (immediate or at period end)

#### 3.1.1 Pause semantics (business pause)

`PAUSED` means **BK intentionally paused fulfilment** (e.g. customer holidays).
It is not a Stripe-driven delinquency state.

Policy:

- If `invoice.payment_failed` occurs while a subscription is `PAUSED`, BK keeps it `PAUSED`.
- Resume can be:
  - manual (customer returns early), or
  - scheduled (`resume_at`), extendable by admin.

**Implementation status (v1):**

- Enforced in webhook reconciliation use-cases:
  - `recordInvoicePaidUseCase`
  - `recordInvoicePaymentFailedUseCase`
  - `recordProviderSubscriptionUpdatedUseCase`
- Provider events **cannot** unpause a BK-paused subscription
- Only an explicit resume action (client/admin) or explicit provider cancellation
  can exit `PAUSED`

This behavior is covered by automated tests and is considered
**contractual behavior** for BK v1.

### 3.2 Allowed transitions (high-level)

- `INCOMPLETE → ACTIVE` on `checkout.session.completed` or `invoice.paid`
- `ACTIVE → PAST_DUE` on `invoice.payment_failed`
- `PAST_DUE → ACTIVE` on `invoice.paid`
- `ACTIVE → CANCELLED` on `customer.subscription.deleted` or cancellation confirmed
- `ACTIVE → PAUSED` on explicit pause action (client or admin)
- `PAUSED → ACTIVE` on resume action (manual or scheduled)
- `PAUSED` is **not affected** by `invoice.payment_failed`

All transitions should emit a `subscriptions_events` entry.

### 3.3 Pause & Resume Semantics (Authoritative)

Pausing is a **business decision**, not a billing failure.

Rules:

- PAUSED is entered only via:
  - Client pause request
  - Admin pause action
  - Provider update explicitly mapped to pause
- Stripe payment failures (`invoice.payment_failed`) MUST NOT override PAUSED.
- While PAUSED:
  - No entitlements are granted
  - Subscription remains billable unless cancelled or provider-paused
- Resume paths:
  - Manual resume (client/admin)
  - Scheduled resume via `resume_at`
  - Provider resume update

Policy (v1):

- While `PAUSED`, BK does not grant entitlements and does not allow ordering.
- Stripe billing events MUST NOT automatically unpause BK.
- `invoice.payment_failed` does not override `PAUSED`. The failure is recorded as an audit event only.
- Admin can:
  - set / extend `resume_at` (customer extends holiday)
  - resume immediately (manual “start now”)
  - pause immediately (manual “pause now”)

Implementation notes:

- Local pause scheduling is represented by:
  - `paused_at` (timestamp when paused)
  - `resume_at` (optional scheduled resume)
- Provider pause/cancel flags are still synchronized via `customer.subscription.updated` for observability,
  but BK pause remains business-owned.

Transitions:

- `ACTIVE → PAUSED` (manual pause)
- `PAUSED → ACTIVE` (resume)
- `PAUSED → CANCELLED` (explicit cancel)

---

## 4. Public API (Transport Layer)

> **Rule:** Transports are thin adapters only (BalanceGuard → parse input → call use-case → respond).

### 4.1 Client routes

#### POST `/api/v1/client/subscriptions/checkout`

**Implementation status:** ✅ Implemented

**Transport notes:**

- Implemented in:

  `src/modules/subscriptions/transport/http/create-subscription-checkout.route.ts`
- Wrapped with BalanceGuard (`client` surface)
- Uses `parseJson` + `validate` for bounded, typed input parsing
- Delegates all business logic to `createSubscriptionCheckoutSessionUseCase`

**Validation rules (runtime-enforced):**

- `plan_id: uuid` (Zod v4: `z.uuid()`)
- `success_url: url` (Zod v4: `z.url()`)
- `cancel_url: url` (Zod v4: `z.url()`)
- Payload size is limited (8KB)

**Security posture:**

- `auth.required = true`
- `auth.roles = ["client"]`
- `origin.required = true`
- `csrf.required = true`
- Rate-limited per `ip + path`

**Response shape:**

```json
{
  "ok": true,
  "data": {
    "checkout_url": "https://checkout.stripe.com/..."
  },
  "request_id": "uuid"
}
```

Start Stripe Checkout for a subscription plan.

- **Auth:** required (`client` role)
- **Origin:** required
- **CSRF:** required
- **Rate limit:** required (stable, keyed per ip+path or per user if safely available)

Body:

- `plan_id: string`
- `success_url: string`
- `cancel_url: string`

Response:

- `200`: `{ checkout_url: string }`

#### GET `/api/v1/client/subscriptions/current`

Return the current subscription summary.

- **Auth:** required (client)
- **Origin:** required

#### POST `/api/v1/client/subscriptions/cancel`

Cancel the subscription (either immediately or at period end).

- **Auth:** required (client)
- **Origin:** required
- **CSRF:** required

Body:

- `at_period_end: boolean`

#### POST `/api/v1/client/subscriptions/resume`

Resume a paused subscription.

- **Auth:** required (client)
- **Origin:** required
- **CSRF:** required

### 4.2 Admin routes

#### POST `/api/v1/admin/subscription-plans`

Create a plan.

#### PATCH `/api/v1/admin/subscription-plans/:id`

Update a plan.

#### POST `/api/v1/admin/subscription-plans/:id/activate`

Activate.

#### POST `/api/v1/admin/subscription-plans/:id/deactivate`

Deactivate.

#### POST `/api/v1/admin/subscriptions/:id/cancel`

Cancel a customer subscription (exceptional).

#### POST `/api/v1/admin/subscriptions/:id/pause`

Pause a customer subscription until a given date.
Body:

- `resume_at: string` (ISO date-time)

#### POST `/api/v1/admin/subscriptions/:id/resume`

Resume immediately (override holiday schedule).

#### PATCH `/api/v1/admin/subscriptions/:id/pause`

Extend or modify `resume_at` (holiday extension).

Admin routes must be stricter RBAC and rate-limited.

---

## 5. Application Layer (Use-cases)

### 5.1 `createSubscriptionCheckoutSession`

Input:

- `actor` (client)
- `plan_id`
- `success_url`, `cancel_url`

Responsibilities:

- Validate plan exists and is `ACTIVE`
- Create a local `subscriptions_subscriptions` record with `status=INCOMPLETE`
- Create a Stripe Checkout Session (mode `subscription`) via Billing/Stripe integration
- Include metadata linking Stripe objects back to BK:
  - `bk_account_id`
  - `bk_subscription_id`
  - `bk_plan_id`
- Return checkout URL

### 5.2 `cancelSubscription`

Input:

- `subscription_id` (current account)
- `at_period_end` boolean

Responsibilities:

- Call provider (Stripe) to set `cancel_at_period_end` or immediate cancel
- Update local subscription record
- Emit `subscriptions_events` (`SUBSCRIPTION_CANCEL_REQUESTED`)

### 5.3 `resumeSubscription`

Input:

- `subscription_id`

Responsibilities:

- Call provider to resume/unpause
- Update local subscription record
- Emit event (`SUBSCRIPTION_RESUMED`)

#### Pause / Resume policy

- Pause is a **business decision**, not a billing failure
- Pausing does not cancel Stripe subscription
- While paused:
  - Subscription does not grant entitlements
  - Payment failures do not change state
- Resume behavior:
  - Admin may set or extend `resume_at`
  - Admin or client may resume immediately
  - Resume clears `paused_at` and `resume_at`

### 5.4 Webhook reconciliation handlers (invoked from Billing module)

> Stripe events are verified + idempotency-claimed in Billing.
> Subscriptions exposes provider-neutral use-cases that apply state updates and emit `subscriptions_events`.

---

### 5.4.0 Provider → Domain Status Mapping (v1)

Subscriptions does not consume Stripe status values directly.

Billing maps provider-specific states into a provider-neutral union:

Provider status (input):

- `INCOMPLETE`
- `ACTIVE`
- `PAST_DUE`
- `CANCELLED`

Domain mapping:

- Provider `ACTIVE` → `ACTIVE`
- Provider `PAST_DUE` → `PAST_DUE`
- Provider `INCOMPLETE` → `INCOMPLETE`
- Provider `CANCELLED` → `CANCELLED`

**Important override rule:**

- If the local subscription is `PAUSED`, provider updates
  **must not** change the status unless the provider indicates `CANCELLED`.

This mapping is enforced in:

- `recordProviderSubscriptionUpdatedUseCase`

#### 5.4.1 `recordCheckoutSessionCompletedUseCase`

Triggered by:

- `checkout.session.completed` (subscription-mode checkout)

Responsibilities:

- Verify the subscription belongs to `account_id` (defense-in-depth)
- Link `provider_subscription_id` (Stripe `sub_...`) onto the local subscription
- Transition `INCOMPLETE → ACTIVE` (v1 policy)
- Emit `subscriptions_events` (`SUBSCRIPTION_CHECKOUT_COMPLETED`)
- Must be idempotent if the provider subscription id is already linked

#### 5.4.2 `recordInvoicePaidUseCase`

Triggered by:

- `invoice.paid`
Note:
- Invoice money fields (`amount_paid`, `currency`) are not stored on `subscriptions_subscriptions`.
- They are captured in `subscriptions_events.payload` and (when implemented) in `billing_transactions`.

Responsibilities:

- If subscription is `CANCELLED`, **no-op** (terminal state)
- If subscription is `PAUSED`, keep `PAUSED`
- If subscription is `INCOMPLETE` or `PAST_DUE`, transition to `ACTIVE`
- Update `current_period_start/end` when provided (best-effort)
- Emit `subscriptions_events` (`SUBSCRIPTION_INVOICE_PAID`)

#### 5.4.3 `recordInvoicePaymentFailedUseCase`

Triggered by:

- `invoice.payment_failed`

Responsibilities:

- If subscription is `CANCELLED`, no-op
- If subscription is `PAUSED` (business pause), keep `PAUSED`
- Otherwise set `PAST_DUE`
- Emit `subscriptions_events` (`SUBSCRIPTION_INVOICE_PAYMENT_FAILED`)

#### 5.4.4 `recordProviderSubscriptionUpdatedUseCase`

Triggered by:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted` (mapped into status update)

Responsibilities:

- Sync provider status + fields:
  - `provider_subscription_id`, `provider_customer_id`
  - `current_period_start`, `current_period_end`
  - `cancel_at_period_end`, `canceled_at`
- For deletion:
  - set local status to `CANCELLED`
  - ensure `canceled_at` is set
- Emit `subscriptions_events` (`SUBSCRIPTION_PROVIDER_UPDATED` or equivalent)

**Business-owned pause rule (BK-owned state):**

- If the local subscription status is `PAUSED`, provider update events MUST NOT move it to `ACTIVE` or `PAST_DUE`.
- Exception: if provider indicates terminal cancellation (`CANCELLED`), BK transitions to `CANCELLED` and sets `canceled_at`.

Rationale:

- `PAUSED` is operational/business pause (holidays, fulfilment hold), not a provider delinquency signal.

---

## 6. Stripe + Billing Integration

### 6.1 Checkout creation

Subscriptions should use Stripe Checkout in **subscription mode**:

- `mode=subscription`
- `line_items` uses `subscriptions_plans.provider_plan_id` (Stripe `price_...`)
- `metadata` links BK ids to Stripe objects

**Critical propagation rule (v1):**
When Billing creates a subscription-mode Checkout Session, it MUST copy BK correlation metadata onto the Stripe Subscription object via:

- `checkout.sessions.create({ subscription_data: { metadata: ... } })`

This ensures that:

- `customer.subscription.created/updated/deleted`
- `invoice.paid` / `invoice.payment_failed`

remain deterministically correlatable even when the event payload does not include Checkout Session metadata.

### 6.2 Webhook reconciliation

Stripe event types relevant to subscriptions:

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Billing module responsibilities:

- Verify webhook signature
- Deduplicate by `event.id`
- Create/update `billing_transactions` and link Stripe objects
- Invoke Subscriptions handler(s) to update `subscriptions_subscriptions`

Subscriptions module responsibilities:

- Apply state machine transitions
- Emit `subscriptions_events`
- Ensure idempotent updates (no duplicate event side effects)

### 6.3 Correlation strategy (v1 — deterministic)

For v1, Billing routes subscription events to Subscriptions **only when correlation metadata is present**.

Required metadata keys on Stripe objects (Checkout Session and/or Subscription/Invoice metadata):

- `bk_account_id`
- `bk_subscription_id`

If these keys are missing, the handler must **skip** (no state write) to avoid misapplying events.
(Fallback correlation by `provider_subscription_id` can be added later.)

---

## 7. Entitlements

### 7.1 Recommended approach

- Subscriptions grant **meals per interval**.
- Preferred pattern: use **Credits module** as the canonical ledger.

On each successful invoice (`invoice.paid`):

- create `billing_transactions` record
- subscriptions handler emits `SUBSCRIPTION_INVOICE_PAID`
- credits ledger grants `meals_per_interval` to account, referencing subscription + invoice transaction

### 7.2 If Credits isn’t ready

- Store a derived “remaining meals” projection elsewhere (temporary), but treat it as a *projection*.
- The canonical audit event remains the Stripe invoice and the subscription state.

---

## 8. Security & Compliance

### 8.1 BalanceGuard requirements

All routes:

- BalanceGuard wrapper required
- Rate limit mandatory
- No PII in logs

Client checkout/cancel/resume (unsafe):

- `auth.required=true`
- `auth.roles=["client"]`
- `origin.required=true`
- `csrf.required=true`

Client read routes (safe):

- `auth.required=true`
- `origin.required=true`
- `csrf` not required

Webhook:

- Lives in Billing module: no auth/origin/csrf; signature verification + idempotency.

### 8.2 Auditability

- Every state transition emits `subscriptions_events`.
- Include `request_id` for HTTP-driven changes.
- For webhook-driven changes, store Billing’s `requestId` when available.

---

## 9. Testing (Required)

Tests live under `/tests/**`.

Minimum coverage:

- `createSubscriptionCheckoutSession`
  - rejects inactive plan
  - creates local subscription `INCOMPLETE`
  - returns checkout URL

- Webhook reconciliation:
  - `invoice.paid` transitions `PAST_DUE → ACTIVE`
  - `invoice.payment_failed` transitions `ACTIVE → PAST_DUE`
  - duplicates are no-ops (idempotent)

- Route adapters:
  - checkout requires auth + origin + csrf
  - cancel/resume require csrf
  - rate limit applies

**Implemented coverage (v1):**

- Webhook invariants:
  - `invoice.paid` does not resurrect `CANCELLED`
  - `invoice.payment_failed` does not override `PAUSED`
  - Provider `ACTIVE` does not unpause BK `PAUSED`
  - Provider `CANCELLED` overrides `PAUSED`
- Route adapters: `POST /api/v1/client/subscriptions/checkout`
  - valid body returns `{ checkout_url }`
  - invalid body throws `InputInvalidError`
  - asserts the use-case is invoked with `actor` + `request_id`
  - Client checkout route validates input and delegates correctly
  - BalanceGuard surface isolation verified (client vs admin)
- All tests run under strict TypeScript + ESLint (`no-explicit-any`)

---

## 10. Implementation Notes

- Router registration uses `router.register("POST", path, handler)`.
- `json(...)` helper is `json(status: number, body: unknown)`.
- Use `ctx.requestId` (camelCase) from BalanceGuard context.
- RateLimit key is a function: `(ctx) => string`.
- Prefer relative imports unless TS path aliases are confirmed for runtime.

---

## 11. Open Questions (defer until build phase)

- Do we support plan upgrades/downgrades in v1?
- Pausing is supported in v1 (business-controlled, not payment-driven).
- Are prorations allowed or disabled for plan changes?
- Are coupons/promo codes enabled in v1?
