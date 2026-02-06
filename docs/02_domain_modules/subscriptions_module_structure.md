# subscriptions_module_structure.md — Subscriptions Module Folder & File Structure (Canonical)

> **Authoritative structure document** for the BK **Subscriptions** module.
>
> This document defines the **complete expected folder + file layout** for Subscriptions.
> It is referenced by `subscriptions_module.md`.
>
> **Rule:** If code layout and this document disagree, **this document wins**.
>
---

## 0. Purpose

Subscriptions owns:

- Subscription plan catalogue
- Customer subscriptions lifecycle state machine
- Subscription entitlement records (monthly capability counters)
- Subscription events (audit/debug)

Subscriptions does **not** own:

- Stripe SDK or webhook verification (Billing owns)
- Packs or Credits ledger mechanics (domain-owned elsewhere)

---

## 1. Canonical Module Root

All Subscriptions code lives under:

```text
src/modules/subscriptions/
```

No Subscriptions domain logic may live in `src/shared/**`.
Only cross-cutting primitives may live in `src/shared/**` (e.g. DB, BalanceGuard, http-client).

---

## 2. Required Folder & File Tree

```text
src/modules/subscriptions/
  README.md
  index.ts

  domain/
    types.ts
    constants.ts
    errors.ts

    entities/
      subscription.ts
      subscription-plan.ts
      subscription-entitlements.ts

    policies/
      status-machine.ts
      pause-policy.ts
      entitlement-policy.ts

    services/
      correlation.ts
      provider-status-mapping.ts

  application/
    ports/
      billing.port.ts
      clock.port.ts
      repo.port.ts
      event-writer.port.ts

    use-cases/
      create-subscription-checkout-session.use-case.ts
      cancel-subscription.use-case.ts
      pause-subscription.use-case.ts
      resume-subscription.use-case.ts
      get-current-subscription.use-case.ts

      webhooks/
        record-checkout-session-completed.use-case.ts
        record-invoice-paid.use-case.ts
        record-invoice-payment-failed.use-case.ts
        record-provider-subscription-updated.use-case.ts

    dtos/
      create-checkout.dto.ts
      cancel.dto.ts
      pause.dto.ts
      resume.dto.ts
      current-subscription.dto.ts

  infrastructure/
    db/
      queries/
        subscription-plans.queries.ts
        subscriptions.queries.ts
        subscription-entitlements.queries.ts
        subscription-events.queries.ts

      repos/
        subscription-plans.repo.ts
        subscriptions.repo.ts
        subscription-entitlements.repo.ts
        subscription-events.repo.ts

      mappers/
        subscription.mapper.ts
        subscription-plan.mapper.ts
        subscription-entitlements.mapper.ts

    adapters/
      billing.adapter.ts
      clock.adapter.ts
      event-writer.adapter.ts

  transport/
    http/
      routes/
        client/
          create-subscription-checkout.route.ts
          get-current-subscription.route.ts
          cancel-subscription.route.ts
          pause-subscription.route.ts
          resume-subscription.route.ts

        admin/
          create-subscription-plan.route.ts
          update-subscription-plan.route.ts
          activate-subscription-plan.route.ts
          deactivate-subscription-plan.route.ts
          cancel-subscription-admin.route.ts
          pause-subscription-admin.route.ts
          resume-subscription-admin.route.ts
          update-subscription-pause-admin.route.ts

      index.ts

  tests/
    unit/
      status-machine.test.ts
      pause-policy.test.ts
      entitlement-idempotency.test.ts

    integration/
      create-checkout-session.test.ts
      webhook-invoice-paid.test.ts
      webhook-payment-failed.test.ts
      webhook-provider-updated.test.ts

  docs/
    notes.md
```

### 2.1 Minimal required set (v1 build gate)

The following files are **mandatory** before the module is considered scaffolded:

- `index.ts`
- `domain/errors.ts`
- `domain/policies/status-machine.ts`
- `application/use-cases/create-subscription-checkout-session.use-case.ts`
- `application/use-cases/webhooks/record-invoice-paid.use-case.ts`
- `application/use-cases/webhooks/record-invoice-payment-failed.use-case.ts`
- `transport/http/routes/client/create-subscription-checkout.route.ts`
- `infrastructure/adapters/billing.adapter.ts`
- `infrastructure/db/repos/subscriptions.repo.ts`

---

## 3. Placement Rules (Non‑Negotiable)

### 3.1 Domain

- `domain/**` contains **pure** business logic (no DB, no HTTP, no Stripe types).
- Stripe event objects must never enter `domain/**`.

### 3.2 Application

- `application/**` contains use-cases and ports.
- Use-cases accept:
  - a **provider-neutral** input (primitives + BK ids)
  - an actor + request_id (when coming from HTTP or Billing)
- Use-cases orchestrate ports and enforce idempotency rules.

### 3.3 Infrastructure

- `infrastructure/**` implements ports (repos, adapters).
- DB specifics live under `infrastructure/db/**`.
- Stripe/Billing calls are via the Billing port only (never direct Stripe SDK usage).

### 3.4 Transport

- `transport/http/**` is thin:
  - parse + validate
  - BalanceGuard
  - call use-case
  - return `json(status, body)`

---

## 4. Interface Contracts

### 4.1 Billing Port (Subscriptions → Billing)

`application/ports/billing.port.ts` defines the only way Subscriptions can ask Billing for provider actions.

Expected methods (v1):

- `createSubscriptionCheckoutSession(...) -> { checkout_url }`
- `cancelProviderSubscription(...)`
- `resumeProviderSubscription(...)`
- `pauseProviderSubscription(...)` *(optional if BK pause is local-only in v1)*

### 4.2 Repo Port

`application/ports/repo.port.ts` is the façade port used by use-cases.
Implementations live in `infrastructure/db/repos/**`.

---

## 5. Update Policy (How This Document Stays Correct)

### 5.1 Change rule

Whenever a file is **added, removed, or moved** under `src/modules/subscriptions/**`, this document MUST be updated in the same PR.

### 5.2 How to update

- Update the tree in **Section 2**.
- If the change affects scaffolding completeness, update **Section 2.1**.
- If a new category of responsibility is introduced, update **Section 3**.

### 5.3 PR checklist

A PR that changes module structure is not complete unless it also:

- updates this document
- keeps the module DDD boundaries intact
- keeps transport thin and BalanceGuard-wrapped

---

## 6. Ownership

- **Owner:** Subscriptions module maintainer
- **Enforcer:** code review + CI lint rule (recommended) that checks for doc update when structure changes

