# drizzle_schema_skeletons.md

> **REFERENCE ONLY — NOT RUNTIME CODE**
>
> This document contains **Drizzle-first schema skeletons** to accelerate development.
> It must always stay aligned with the canonical database spec:
>
> - `balance_kitchen_schema.md` (source of truth)
>
> If anything here conflicts with `balance_kitchen_schema.md`, **the schema document wins**.

Related docs:

- `balance.md`
- `balance_kitchen_architecture.md`
- `balance_kitchen_toolkit.md`
- `balanceguard.md`
- `balanceguard_structure.md`

---

## 1. Purpose

These skeletons exist to:

- Keep schema code consistent across modules
- Encourage **reusable column helpers**
- Reduce drift between module schemas
- Prevent circular imports by defining a shared **core schema**

This is a **developer guide**. Real schema code lives in:

- `src/shared/db/schema/core.ts` (cross-module “core” tables)
- `src/modules/<module>/infrastructure/db/schema.ts` (module-owned tables)

---

## 2. Canonical Conventions

### 2.1 Naming

- Tables: `module_entity` (snake_case)
- Columns: `snake_case`
- Foreign keys: `<thing>_id`

### 2.2 Types

- PKs: `uuid`
- Timestamps: `timestamptz`
- JSON: `jsonb`

### 2.3 Common columns

Most tables should include:

- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- optional `deleted_at` (timestamptz)
- optional `request_id` (uuid) for BalanceGuard traceability

---

## 3. Drizzle File Placement Rules

### 3.1 Shared DB helpers

- `src/shared/db/columns.ts` — reusable column builders
- `src/shared/db/schema/core.ts` — core tables referenced by many modules

### 3.2 Module schemas

- `src/modules/<module>/infrastructure/db/schema.ts` — module-owned tables

### 3.3 Import rules

- `src/shared/**` must not import from `src/modules/**`
- `src/modules/**` may import from `src/shared/**`

---

## 4. Shared Column Helpers (Skeleton)

> Implement these in `src/shared/db/columns.ts`.

```ts
import { pgTable, uuid, timestamp, text, boolean, integer, jsonb } from "drizzle-orm/pg-core";

export const pk = (name = "id") => uuid(name).primaryKey();

export const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const deletedAt = () => timestamp("deleted_at", { withTimezone: true });

export const requestId = () => uuid("request_id");

export const statusText = (name = "status") => text(name).notNull();
```

> **Note:** `updated_at` auto-update behavior is typically enforced in application/repository code or via DB triggers.

---

## 5. Core Schema (Cross-module tables)

> Implement these in `src/shared/db/schema/core.ts`.
>
> Core tables are those referenced across many modules (identity, accounts, billing idempotency).

### 5.1 identity_users

```ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { pk, createdAt, updatedAt, statusText } from "@/shared/db/columns";

export const identityUsers = pgTable("identity_users", {
  id: pk(),
  email: text("email").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  passwordHash: text("password_hash"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  status: statusText(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Add unique index for email in real schema file.
```

### 5.2 identity_roles + identity_role_assignments

```ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { pk, createdAt } from "@/shared/db/columns";

export const identityRoles = pgTable("identity_roles", {
  id: pk(),
  key: text("key").notNull(),
  label: text("label").notNull(),
  createdAt: createdAt(),
});

export const identityRoleAssignments = pgTable("identity_role_assignments", {
  id: pk(),
  userId: uuid("user_id").notNull(),
  roleKey: text("role_key").notNull(),
  accountId: uuid("account_id"),
  createdAt: createdAt(),
});

// In real schema: add FKs + indexes; roleKey should align with balanceguard.md roles.
```

### 5.3 identity_sessions (server-side sessions)

```ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { pk, createdAt } from "@/shared/db/columns";

export const identitySessions = pgTable("identity_sessions", {
  id: pk(),
  userId: uuid("user_id").notNull(),
  sessionTokenHash: text("session_token_hash").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ipCreated: text("ip_created"),
  userAgentCreated: text("user_agent_created"),
  createdAt: createdAt(),
});

// Store only a hash of the session token (never raw token).
```

### 5.4 identity_login_attempts (abuse control)

```ts
import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { pk, createdAt } from "@/shared/db/columns";

export const identityLoginAttempts = pgTable("identity_login_attempts", {
  id: pk(),
  email: text("email").notNull(),
  userId: uuid("user_id"),
  ip: text("ip").notNull(),
  userAgent: text("user_agent"),
  success: boolean("success").notNull(),
  failureReason: text("failure_reason"),
  createdAt: createdAt(),
});
```

### 5.5 accounts_accounts

```ts
import { pgTable, uuid, text } from "drizzle-orm/pg-core";
import { pk, createdAt, updatedAt, statusText } from "@/shared/db/columns";

export const accountsAccounts = pgTable("accounts_accounts", {
  id: pk(),
  name: text("name").notNull(),
  status: statusText(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
```

### 5.6 billing_stripe_events (idempotency + audit)

```ts
import { pgTable, uuid, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { pk, createdAt, requestId, statusText } from "@/shared/db/columns";

export const billingStripeEvents = pgTable("billing_stripe_events", {
  id: pk(),
  stripeEventId: text("stripe_event_id").notNull(),
  type: text("type").notNull(),
  apiVersion: text("api_version"),
  liveMode: boolean("livemode").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  status: statusText(),
  lastError: text("last_error"),
  requestId: requestId(),
  relatedAccountId: uuid("related_account_id"),
  relatedTransactionId: uuid("related_transaction_id"),
  rawEventRedacted: jsonb("raw_event_redacted"),
  createdAt: createdAt(),
});

// In real schema: unique index on stripe_event_id.
```

---

## 6. Module Schema Template

> Implement each module’s schema in `src/modules/<module>/infrastructure/db/schema.ts`.

```ts
import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { pk, createdAt, updatedAt, requestId, statusText } from "@/shared/db/columns";

export const moduleThings = pgTable("<module>_<things>", {
  id: pk(),
  accountId: uuid("account_id").notNull(),
  status: statusText(),
  payload: jsonb("payload"),
  requestId: requestId(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Add indexes and FKs in the real implementation.
```

### Guidance

- Prefer **append-only event tables** for critical audits:
  - credits ledger
  - billing stripe events
  - activity events
- Use `request_id` where it helps trace incidents.

---

## 7. Stripe-Related Table Skeletons (Module-owned)

> Transactions and line items are typically module-owned under `billing`.

```ts
import { pgTable, uuid, text, integer, jsonb } from "drizzle-orm/pg-core";
import { pk, createdAt, updatedAt, requestId, statusText } from "@/shared/db/columns";

export const billingTransactions = pgTable("billing_transactions", {
  id: pk(),
  accountId: uuid("account_id").notNull(),
  userId: uuid("user_id"),
  kind: text("kind").notNull(),
  status: statusText(),
  currency: text("currency").notNull(),
  amountCents: integer("amount_cents").notNull(),
  provider: text("provider").notNull(),
  providerPaymentIntentId: text("provider_payment_intent_id"),
  providerChargeId: text("provider_charge_id"),
  providerInvoiceId: text("provider_invoice_id"),
  providerCheckoutSessionId: text("provider_checkout_session_id"),
  idempotencyKey: text("idempotency_key"),
  metadata: jsonb("metadata"),
  requestId: requestId(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
```

---

## 8. Index / Constraint Checklist

When implementing real schema files, ensure:

- Unique indexes:
  - `identity_users.email`
  - `identity_roles.key`
  - `identity_sessions.session_token_hash`
  - `billing_stripe_events.stripe_event_id`
  - `billing_transactions.idempotency_key` (when present)

- Common indexes:
  - `(account_id, created_at desc)` on read-heavy tables
  - `(user_id, revoked_at, expires_at)` on sessions

- Foreign keys:
  - add explicit FKs per `balance_kitchen_schema.md`
  - choose `ON DELETE` behavior intentionally

---

## 9. BalanceGuard Alignment Notes

Because BK uses **cookie sessions + CSRF**:

- `identity_sessions` is mandatory for server-side invalidation.
- CSRF tokens should not be stored in DB by default (double-submit cookie), but the system must support revocation via session invalidation.
- `request_id` should be included on high-value audit tables.

---

## 10. Final Reminder

This file is a **skeleton**. Real schemas must:

- conform to `balance_kitchen_schema.md`
- live in the correct folders
- include proper indexes and constraints
- avoid circular imports by keeping shared truth in `core.ts`

