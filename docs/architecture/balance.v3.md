# balance.md — Master System Document

> **Canonical source of truth** for the Balance Kitchen (BK) platform.
>
> This document defines the **intent, scope, philosophy, lifecycle, architecture, and non‑negotiable rules** for the entire system.
>
> All other documents, code, and tooling **must conform** to this file.

---

## 0. Status & Change Log

**Status:** Approved (v3)

**What changed in v3:**

- Aligned system intent with `balance_kitchen_business_model.md` (policy + lifecycle)
- Introduced the **authoritative customer lifecycle** (relationship-led, pack-anchored)
- Clarified Packs vs Subscriptions vs Credits semantics (inventory vs entitlements vs ledger)
- Introduced **preset-driven ordering** as a core product mechanic
- Renamed AMX to **Account Manager Xperience (AMXperience)**
- Clarified chat evolution: future **site chat funnel** as primary relationship + gamification surface
- Reinstated full system rules (toolkit, accessibility, testing, governance) while keeping new lifecycle policies
- `balance_kitchen_schema.md` — canonical PostgreSQL schema (tables, constraints, indexes)
- `devops_setup.md` — trunk-based development, versioning, CI/CD, migrations, and operational controls

---

## 1. What is Balance Kitchen?

**Balance Kitchen (BK)** is a production‑grade, relationship‑led meal‑prep and lifestyle platform designed to support:

- A public **marketing site**
- An authenticated **client dashboard**
- An authenticated **admin dashboard**
- Secure packs, subscriptions, credits, and payments
- Weekly menu ordering with preset-driven customisation
- In‑house delivery tracking
- Activity logging and notifications
- A realtime **chat system** supporting:
  - public site chat widget (anonymous)
  - authenticated chat (client/admin) with structured spaces
  - delegated moderation (admin-nominated moderators)

Balance Kitchen is designed to scale **operationally and technically** while remaining:

- Understandable
- Auditable
- Secure

This is not a demo application.
This is a long‑lived production system.

---

## 2. Customer Lifecycle (Authoritative)

Balance Kitchen operates on a **state-based lifecycle**, not a growth funnel.

```text
Visitor
  ↓
Conversation with Account Manager
  ↓
Manual / Assisted Onboarding
  ↓
Pack Purchase
  ↓
Subscription Applied
  ↓
Weekly Ordering Loop
  ↓
Meal Consumption
  ↓
Subscription Auto-Pause / Reactivation / Cancellation
```

**Ordering enforcement:**

Weekly ordering is governed by a canonical Ordering module which enforces:

- kitchen-authoritative weekly windows
- one order per account per week
- pack-anchored meal consumption
- subscription capability entitlements
- deterministic preset resolution at confirmation

No UI or transport layer may bypass these rules.

This lifecycle governs:

- UX decisions
- Pricing rules
- Subscription behaviour
- Entitlement logic
- Admin workflows

No feature may bypass or contradict this lifecycle.

---

## 3. Core Economic Model (Packs, Subscriptions, Credits)

### 3.1 Packs (Economic Anchor)

- Packs represent **purchased meals** (pack-derived purchased entitlements)
- Packs are exhaustible
- Packs are the **economic anchor** of the system

Packs govern:

- whether a customer may order meals
- whether a subscription may remain active

---

### 3.2 Subscriptions (Entitlement Layer)

Subscriptions are a **service + entitlement layer**.

They define:

- customisation depth
- ingredient access (tier gating)
- preset meal layouts
- urgency allowances
- support level (including AMXperience)

**Critical rule (locked):**

- Subscriptions are **active only while meals/pack balance remain**
- When meals reach zero:
  - subscription auto-pauses
  - after a 7-day grace period, the subscription is cancelled if not reactivated

---

### 3.3 Credits (Ledger, Planned)

Credits are the **internal entitlement ledger**.

BK uses two credit classes with strict separation:

- **Locked credits** (pack-backed)
  - Represent meal value associated with packs
  - Are consumed as meals are ordered (via pack consumption)
  - Expire when the pack reaches zero
  - May be explicitly converted into unlocked credits (one-way)

- **Unlocked credits** (spendable entitlements)
  - Are never consumed to purchase meals
  - Are exchanged for reward-shop items or vouchers (future)
  - Earned/unlocked credits expire after 12 months

**Conversion rule (locked):**
Locked credits may be unlocked (which decrements pack meals).  
Unlocked credits can never become locked credits.

Credits are factual state and must never be gamified visually.

---

### 3.4 Reward Shop Items (Planned)

Unlocked credits may be exchanged for **items** (e.g., vouchers or meal tokens) via the Reward Shop.

**Locked rule:**
Ordering consumes packs / locked meal value.  
Ordering does not consume unlocked credits.  
Items — not credits — may authorize exceptional ordering actions (e.g., late-order or cancellation vouchers).

---

## 4. Preferences & Preset-Driven Ordering

### 4.1 Preferences

- Preferences are editable at any time
- Preference changes apply **on the next subscription renewal**
- Preferences may affect pricing, entitlements, and service level

---

### 4.2 Preset-Driven Meal Layouts (Core Mechanic)

For eligible subscription tiers, customers may configure **preset dish layouts**.

Preset layouts:

- are configured during onboarding or via account settings
- may be set with or without Account Manager assistance
- use **percentage-based distribution** (e.g. 50/50, 75/25)
- automatically resolve vegetable and carbohydrate allocation per order

Manual per-meal overrides are optional and tier-gated.

---

## 5. Canonical Technology Decisions (Locked)

These decisions are **intentional and final** unless explicitly revised in documentation.

### 5.1 Backend

- **Language:** TypeScript (strict)
- **Runtime:** Node.js (LTS)
- **Style:** Framework‑free
  - Native `http`
  - Native WebSockets
- **Architecture:** Domain‑Driven Design (DDD)
- **Security:** BalanceGuard (mandatory)
- **Logging:** Pino (only logger)
- **Payments:** Stripe (only provider)
- **Delivery:** In‑house drivers (no courier APIs)

### 5.2 Frontend

- **Language:** TypeScript
- **UI:** HTML + DOM APIs
- **Styling:** CSS Modules + design tokens only
- **Accessibility:** Mandatory (WCAG AA, keyboard‑first)
- **Frameworks:** ❌ None (no React, Next.js, Vue, etc.)

Strict rules:

- No client frameworks
- No virtual DOM
- No runtime JSX

### 5.3 Database

- **Database:** PostgreSQL
- **Access:** Drizzle ORM + explicit SQL
- **Source of truth:** `balance_kitchen_schema.md`

---

## 6. Core Modules (Canonical Index)

Balance Kitchen (BK) is composed of explicit, domain-bounded modules.
Each module has a **canonical specification document** that defines its responsibilities, boundaries, and integration rules.

> If a module has a spec document, implementations must conform to it.
> Do not invent structure or behaviour outside these definitions.

### 6.1 Identity

**Spec:** `identity_module.md`

- Users, accounts, roles
- Actor resolution inputs for BalanceGuard
- Account ownership and role membership

### 6.2 Enquiry

**Spec:** `enquiry_module.md`

- Marketing enquiries and conversion flow
- Enquiry lifecycle and audit events
- Entry point into the customer journey

### 6.3 Customer Preferences

**Spec:** `customer_preferences_module.md`

- Dietary preferences and rules
- Preference evaluation logic
- Preference auditability

### 6.4 Chat

**Spec:** `chat_module.md`

- Client ↔ account manager messaging
- Conversations, messages, permissions
- Moderation and audit trail

### 6.5 Billing (Stripe Integration Core)

**Spec:** `billing_module.md`

- Stripe SDK integration
- Webhook verification and idempotency
- Canonical transaction ledger
- Dispatch of billing facts to domain modules

Billing is the **only module** permitted to communicate with Stripe.

### 6.6 Packs

**Spec:** `packs_module.md`

- Pack product catalogue
- One-off pack purchases
- Pack lifecycle events and entitlements

Integrates with Billing for payment and reconciliation.

### 6.7 Subscriptions

**Spec:** `subscriptions_module.md`

- Subscription plans
- Customer subscription lifecycle
- Recurring billing reconciliation
- Period-based entitlements

Integrates with Billing for payment and reconciliation.

### 6.8 Credits (Planned)

**Spec:** `credits_module.md`

- Canonical entitlement ledger (append-only)
- Locked vs unlocked credit classes
- One-way unlocking (locked → unlocked)
- Expiry, reversals, and audit events
- Reward shop integration (future)

### 6.9 Reward Shop (Planned)

**Spec:** `reward_shop_module.md`

- Controlled exchange of **unlocked credits** into **items**
- Item inventory per account (vouchers, tokens, food items)
- Redemption constraints (late-order, cancellation, etc.)
- Non-refundable purchases
- Anti-abuse guardrails and audit events

Reward Shop exists to provide flexibility **without eroding pack economics**.

### 6.10  Menu / Delivery / Notifications (Planned)

These modules are part of the long-term BK business model but require canonical module specs before development:

- Menu / Meals
- Delivery (in-house drivers)
- Notifications (email / in-app)

---

### 6.11 Ordering

**Spec:** `ordering_module.md`

- Weekly ordering window and lifecycle
- One order per account per week
- Enforcement of pack balance and subscription entitlements
- Preset-driven allocation (percentage-based, deterministic)
- AM-only cancellations and exception handling
- Production cutoff locking (kitchen-authoritative)

Ordering is the **execution engine** that consumes packs, applies subscription capabilities, and hands off to fulfilment.

### 6.12 Database Schema (Canonical)

**Spec:** `balance_kitchen_schema.md`

- Authoritative PostgreSQL schema for the platform
- Defines tables, constraints, indexes, and invariants
- Encodes economic integrity (packs, entitlements, ordering)
- Enables auditability and deterministic reconciliation

### 6.13 DevOps & Delivery (Canonical)

**Spec:** `devops_setup.md`

- Trunk-based development workflow (short-lived branches)
- SemVer + release tagging (`vX.Y.Z`)
- CI quality gates (typecheck, lint, tests, build)
- Mandatory BalanceGuard compliance checks in CI
- Migration discipline + safe rollout patterns
- Staging continuous deploy, production tag-based deploy

---

## 7. Module Governance Rules

- Modules must not bypass each other’s boundaries
- Payments always flow through Billing
- Entitlements belong to Packs, Subscriptions, or Credits
- Cross-cutting concerns live in `shared/`
- Transport layers remain thin adapters only

---

## 8. System Surfaces

Balance Kitchen consists of **three primary surfaces**.

### 8.1 Marketing Site

- Public
- Framework‑free DOM rendering
- Static + dynamic content
- Enquiry and request‑access flows
- No authentication required
- Optional public **chat widget** for new/prospective customers:
  - Shows admin presence (online/offline)
  - If online: live chat to admin inbox
  - If offline: message is stored as inbox message for later response
  - Anonymous-only (no sessions)
  - Aggressively rate-limited

**Future direction:**
In the future, Balance Kitchen will introduce an internally built, **Discord-style chat system** where primary customer contact originates through a structured marketing-site chat funnel. This becomes a key surface where **gamification experiences are delivered and enhanced**.

### 8.2 Client Dashboard

- Authenticated clients
- Order meals
- Manage packs, subscriptions, credits
- View delivery status
- Chat with account manager
- View activity & transaction logs

### 8.3 Admin Dashboard

- Authenticated staff
- Manage clients
- Manage menus, packs, subscriptions
- Manage deliveries
- Respond to enquiries
- Monitor system activity

Each surface has its own frontend entry point but shares backend APIs.

---

## 9. Architecture at a Glance

```text
Frontend (HTML + TS + CSS Modules)
        │
        ▼
HTTP / WebSocket Adapters (src/server)
        │
        ▼
Application Layer (Use‑Cases)
        │
        ▼
Domain Layer (Business Rules)
        │
        ▼
Infrastructure (DB, Stripe, Email, etc.)
```

Cross‑cutting concerns (security, logging, config, tokens) live in `src/shared/`.

---

## 10. BalanceGuard (Security Contract)

**BalanceGuard** is the mandatory security wrapper for Balance Kitchen.

### 10.1 What BalanceGuard Enforces

- Request correlation (`request_id`)
- IP extraction with trusted proxy rules
- Rate limiting
- Identity resolution (session → actor)
- Authentication & authorization (RBAC)
- CSRF protection for unsafe methods
- Origin and CORS enforcement
- Security headers
- Error normalization
- Security event logging

### 10.2 Identity & Actor Model

- Every request resolves an **Actor**:
  - `anonymous`
  - `client`
  - `admin`
  - `account_manager`
  - `super_admin`
  - `system`

- Actor resolution is session‑based
- Session tokens are opaque and stored server‑side
- Cookies never store identity data

### 10.3 Error Semantics (Locked)

- `AUTH_REQUIRED` → no valid session
- `AUTH_INVALID` → invalid credentials
- `FORBIDDEN` → authenticated but not authorized

Error semantics must remain consistent across the system.

### 10.4 Non‑Negotiable Rule

> **Every HTTP route must be wrapped by BalanceGuard.**

WebSocket connections must authenticate and authorize during the handshake and per event.

✅ The database enforces core integrity:

- foreign keys, uniqueness, and invariants are enforced at the DB layer
- financial/entitlement facts are append-only where required
- application code must not be the sole line of correctness

✅ CI/CD is part of governance:

- Changes must pass CI quality gates
- BalanceGuard route compliance is enforced in CI
- Schema changes require both migrations and schema doc updates

---

## 11. Backend Server Structure

The backend lives under:

```text
src/server/
  http/
    server.ts
    router.ts
    routes/
  websocket/
    ws-server.ts
    ws-router.ts
```

Rules:

- `router.ts` only matches method + path
- Route handlers are thin adapters
- All routes are BalanceGuard‑wrapped
- Route composition: server route files may import module route registrars

---

## 12. Shared Toolkit

All reusable primitives are defined in:

- **`balance_kitchen_toolkit.md`**

This includes:

- HTTP utilities
- Validation helpers
- Error normalization
- Logging
- Database helpers
- Stripe helpers
- Security primitives (BalanceGuard / WSGuard)
- Frontend utilities (e.g. CSS Modules helpers)

No ad‑hoc helpers are allowed outside the toolkit.

---

## 13. Design System & Accessibility

### 13.1 Design Tokens

- All styling is driven by tokens
- Tokens live in `balance_kitchen_tokens.md`
- No hard‑coded colors, spacing, shadows, or radii

### 13.2 CSS Modules (Strict)

- CSS Modules are mandatory for site styling
- `noUncheckedIndexedAccess` is enforced
- Class access **must** use a safe helper (`mustClass`)
- Missing CSS classes must fail fast

### 13.3 Accessibility Rules

- Semantic HTML first
- Keyboard navigation for all interactive elements
- Visible focus states
- Correct ARIA usage
- Respect `prefers‑reduced‑motion`

Accessibility is **not optional**.

---

## 14. Testing Philosophy

Testing is a core requirement.

### 14.1 Expectations

- Domain logic must be unit tested
- Application use‑cases must be tested
- HTTP & WS adapters must be integration tested
- Stripe webhooks must be tested with fixtures

### 14.2 Rules

- Tests live under `/tests/**`
- Tests mirror source structure
- No production secrets in tests

---

## 15. Documentation Is Part of the System

### 15.1 Mandatory Update Rule

Whenever a change introduces:

- A new folder or module
- A structural or architectural change
- A new subsystem
- Security or BalanceGuard changes
- Logging changes
- Middleware behavior changes
- New design tokens
- Deprecation of an existing pattern

You **must** notify using this exact sentence:

> “We will need to update [ document/s name ] as there has been changes that will need to be inserted.”

### 15.2 Source of Truth

If code and documentation disagree:

> **The documentation wins.**

---

## 16. Governance Rules (Absolute)

1. No business logic in transports or UI
2. DDD module boundaries must be respected
3. BalanceGuard is mandatory for HTTP
4. WebSockets must authenticate & authorize
5. Env vars only via `shared/config/env.ts`
6. Pino is the only logger
7. Tokens drive all styling
8. Accessibility is mandatory
9. Tests are required
10. Documentation must stay current

---

## 17. Compliance & Audit Alignment

Balance Kitchen is designed to be **audit-ready by construction**, without introducing compliance-driven complexity into the codebase.

The system’s security model is aligned with:

- SOC 2 Common Criteria (Security)
- Enterprise security questionnaires
- Principle of least privilege
- Defense-in-depth architecture

This alignment is documented in:

- **Security Responsibility Matrix**
- **SOC 2 (Common Criteria) Control Mapping**

These documents describe how existing controls satisfy formal security expectations.
They do not introduce additional runtime requirements.

---

## 18. Final Statement

Balance Kitchen is designed to be:

- Secure
- Understandable
- Scalable
- Maintainable
- Framework-independent

All contributors (human or AI) are expected to follow this document exactly.
