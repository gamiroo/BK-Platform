# billing_folder_structure.md — Billing Module Folder & File Structure (Canonical)

> **Canonical file + folder layout** for the Billing module in Balance Kitchen (BK).
>
> **Purpose:** Make Billing implementation deterministic, reviewable, and easy to keep aligned with `billing_module.md` and `balance_kitchen_schema.md`.
>
> **Rule:** If Billing code layout and this document disagree, **this document wins** until intentionally revised.
>
> **Update contract (locked):**
>
> - Any PR that **adds/removes/renames** a Billing file MUST update:
>   1) this document, and
>   2) the “Folder Structure” section of `billing_module.md`.
> - If a file is removed, the PR must also remove its reference here.
> - Paths are canonical and use lower_snake_case.

---

## 1) Module root

```text
src/modules/billing/
  README.md
  index.ts

  domain/
    types/
      billing-types.ts
      billing-enums.ts
      stripe-types.ts

    policies/
      return_url_policy.ts
      stripe_event_allowlist.ts
      correlation_policy.ts
      payload_retention_policy.ts

    errors/
      billing-errors.ts

  application/
    use_cases/
      handle_stripe_billing_webhook.use_case.ts
      create_pack_checkout_session.use_case.ts
      create_subscription_checkout_session.use_case.ts

    services/
      correlation_service.ts
      transaction_ledger_service.ts
      line_items_service.ts
      event_processing_service.ts

    ports/
      stripe_port.ts
      billing_repo_port.ts

  infrastructure/
    db/
      billing.repo.ts
      billing_events.repo.ts
      billing_transactions.repo.ts
      billing_line_items.repo.ts
      billing_customers.repo.ts

      mappers/
        stripe_event_mapper.ts
        stripe_object_mapper.ts

    stripe/
      stripe_client.ts
      webhook_verify.ts
      idempotency_keys.ts
      checkout_create.ts

    config/
      billing_env.ts

  transport/
    http/
      routes/
        stripe_billing_webhook.route.ts

      adapters/
        webhook_http_adapter.ts

      index.ts

  __tests__/
    billing_webhook_signature.test.ts
    billing_webhook_idempotency.test.ts
    billing_transactions_persistence.test.ts
    billing_dispatch_integration.test.ts
```

---

## 2) Responsibilities by folder

### `domain/`

Pure policy and contracts:

- **No DB** and **no Stripe SDK** imports.
- Contains:
  - allowlist of Stripe event types
  - return URL allowlist rules
  - correlation keys contract (`bk_account_id`, `bk_subscription_id`, etc.)
  - payload retention rules and redaction expectations
  - domain-specific errors (normalized error codes / messages)

### `application/`

Use-cases and orchestration:

- Implements:
  - `handleStripeBillingWebhook`
  - `createStripeCheckoutSessionForPack`
  - `createStripeCheckoutSessionForSubscription`
- Depends on **ports** (`stripe_port`, `billing_repo_port`) not on concrete implementations.

### `infrastructure/`

Concrete implementations:

- DB repos (Drizzle + SQL)
- Stripe adapter (SDK init, signature verify, checkout create)
- Env/config parsing (`billing_env.ts`)

### `transport/http/`

Thin route adapters:

- Always BalanceGuard wrapped.
- Webhook route:
  - reads raw body
  - verifies signature
  - calls `handle_stripe_billing_webhook.use_case.ts`

### `__tests__/`

Contract tests that enforce idempotency, signature verification, persistence, and dispatch.

---

## 3) Public entrypoints (locked)

- `src/modules/billing/index.ts`
  - exports:
    - `registerBillingHttpRoutes(router)`
    - any *provider-neutral* Billing application entrypoints used by other modules

- `src/modules/billing/transport/http/index.ts`
  - defines route registrations for Billing routes only (webhook + optional admin diagnostics if ever added).

---

## 4) Cross-module shared placement rules

Stripe infrastructure that is *truly shared* (rare) may live in:

```text
src/shared/stripe/
  stripe_client.ts
  webhook_verify.ts
  idempotency_keys.ts
  safe_logging.ts
```

But:

- Billing is still the **only module that uses Stripe**.
- Shared Stripe code is limited to generic helpers (verification, idempotency key helpers, safe logging).
- Domain mappings and event routing remain in Billing.

---

## 5) How to update this document

When you:

- add a file → add it to the tree (Section 1) and describe its purpose (Section 2)
- remove a file → remove it from the tree and remove any references to it
- rename/move a file → update paths everywhere (this doc + `billing_module.md`)

PR checklist (required):

- [ ] Tree updated
- [ ] `billing_module.md` folder structure snippet updated
- [ ] Imports still respect DDD boundaries (domain has no infra imports)
- [ ] Tests updated or added when behavior changes

