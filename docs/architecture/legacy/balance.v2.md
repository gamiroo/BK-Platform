# balance.md — Master System Document (v2)

> **Canonical source of truth** for the Balance Kitchen (BK) platform.
>
> This document defines the **intent, scope, philosophy, architecture, and non‑negotiable rules** for the entire system.
>
> All other documents, code, and tooling **must conform** to this file.

---

## 0. Status & Change Log

**Status:** Approved (v2)

**What changed in v2:**:

- Confirmed framework‑free architecture (TS + Node + DOM)
- Formalized `src/server` as the canonical backend surface
- Locked in BalanceGuard request lifecycle (identity → actor → context)
- Documented actor model and session‑based authentication
- Codified strict CSS Modules strategy (`mustClass`) as a frontend rule
- Clarified error semantics (`AUTH_REQUIRED` vs `AUTH_INVALID`)

---

## 1. What is Balance Kitchen?

**Balance Kitchen (BK)** is a production‑grade meal‑prep and lifestyle platform designed to support:

- A public **marketing site**
- An authenticated **client dashboard**
- An authenticated **admin dashboard**
- Secure ordering, subscriptions, credits, and payments
- In‑house delivery tracking
- Activity logging and notifications
- A realtime **chat system** supporting:
  - public site chat widget (anonymous)
  - authenticated chat (client/admin) with structured spaces (lobbies, sub-lobbies, rooms)
  - delegated moderation (admin-nominated moderators)

Balance Kitchen is designed to scale **operationally and technically** while remaining:

- Understandable
- Auditable
- Secure

This is not a demo application.
This is a long‑lived production system.

---

## 2. Canonical Technology Decisions (Locked)

These decisions are **intentional and final** unless explicitly revised in documentation.

### 2.1 Backend

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

### 2.2 Frontend

- **Language:** TypeScript
- **UI:** HTML + DOM APIs
- **Styling:** CSS Modules + design tokens only
- **Accessibility:** Mandatory (WCAG AA, keyboard‑first)
- **Frameworks:** ❌ None (no React, Next.js, Vue, etc.)

Strict rules:

- No client frameworks
- No virtual DOM
- No runtime JSX

### 2.3 Database

- **Database:** PostgreSQL
- **Access:** Drizzle ORM + explicit SQL
- **Source of truth:** `balance_kitchen_schema.md`

---

## 3. Core Modules (Canonical Index)

Balance Kitchen (BK) is composed of explicit, domain-bounded modules.
Each module has a **canonical specification document** that defines its
responsibilities, boundaries, and integration rules.

> If a module has a spec document, implementations must conform to it.
> Do not invent structure or behaviour outside these definitions.

---

### 3.1 Identity

**Spec:** `identity_module.md`

- Users, accounts, roles
- Actor resolution inputs for BalanceGuard
- Account ownership and role membership

---

### 3.2 Enquiry

**Spec:** `enquiry_module.md`

- Marketing enquiries and conversion flow
- Enquiry lifecycle and audit events
- Entry point into the customer journey

---

### 3.3 Customer Preferences

**Spec:** `customer_preferences_module.md`

- Dietary preferences and rules
- Preference evaluation logic
- Preference auditability

---

### 3.4 Chat

**Spec:** `chat_module.md`

- Client ↔ account manager messaging
- Conversations, messages, permissions
- Moderation and audit trail

---

### 3.5 Billing (Stripe Integration Core)
**Spec:** `billing_module.md`

- Stripe SDK integration
 Webhook verification and idempotency 
- Canonical transaction ledger
- Dispatch of billing facts to domain modules
- Stripe SDK integration
- Webhook verification and idempotency
- Canonical transaction ledger
- Dispatch of billing facts to domain modules

Billing is the **only module** permitted to communicate with Stripe.

---

### 3.6 Packs
**Spec:** `packs_module.md`

- Pack product catalogue
- One-off pack purchases
- Pack lifecycle events and entitlements

Integrates with Billing for payment and reconciliation.

---

### 3.7 Subscriptions
**Spec:** `subscriptions_module.md`

- Subscription plans
- Customer subscription lifecycle
- Recurring billing reconciliation
- Period-based entitlements

Integrates with Billing for payment and reconciliation.

---

### 3.8 Credits (Planned)
**Spec:** _TBD_

- Canonical entitlement ledger
- Append-only credit adjustments
- Balance projections

Packs and Subscriptions are expected to grant entitlements into Credits
once implemented.

---

### 3.9 Ordering / Menu / Delivery / Notifications (Planned)

These modules are part of the long-term BK business model but are not yet
implemented. Each requires a canonical module spec before development:

- Menu / Meals
- Ordering
- Delivery (in-house drivers)
- Notifications (email / in-app)

---

## 4. Module Governance Rules

- Modules must not bypass each other’s boundaries
- Payments always flow through Billing
- Entitlements always belong to Packs, Subscriptions, or Credits
- Cross-cutting concerns live in `shared/`
- Transport layers remain thin adapters only


## 5. Philosophy

### 5.1 Build From First Principles

Balance Kitchen intentionally avoids heavy frameworks in order to:

- Maintain full control over execution flow
- Avoid abstraction leakage
- Reduce long‑term maintenance risk
- Keep the system understandable to humans and AI

Libraries are allowed.
Frameworks are avoided.

---

### 5.2 Domain‑Driven Design Is Mandatory

- Business logic lives in **domain modules**
- Application workflows live in **use‑cases**
- Transport layers (HTTP / WebSockets) are **thin adapters only**

There is **no business logic** in:

- HTTP routes
- WebSocket handlers
- UI rendering code
- Shared utilities

---

### 5.3 Security Is a First‑Class Feature

Security is not a plugin.
It is part of the architecture.

All inbound traffic must:

- Have a request ID
- Be rate‑limited
- Resolve an actor (anonymous or authenticated)
- Be authenticated and authorized when required
- Emit structured logs
- Return standardized error responses

This contract is enforced through **BalanceGuard**.

### 5.4 Security Responsibility Boundaries

Balance Kitchen explicitly separates **security responsibilities** across application code, infrastructure, CI/CD tooling, and organizational controls.

- Runtime application security is enforced by **BalanceGuard / WSGuard**
- Infrastructure security (TLS, disk encryption, firewalls, backups) is owned by the platform provider
- Supply-chain and static analysis security is owned by CI/CD pipelines
- Human access, devices, and policies are owned by organizational operations

These boundaries are defined in:

- **Security Responsibility Matrix**
- **SOC 2 (Common Criteria) Control Mapping**

This separation is intentional and non-negotiable.  
Application code must not re-implement infrastructure or organizational controls.


---

## 6. System Surfaces

Balance Kitchen consists of **three primary surfaces**.

### 6.1 Marketing Site

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


### 6.2 Client Dashboard

- Authenticated clients
- Order meals
- Manage packs, subscriptions, credits
- View delivery status
- Chat with account manager
- View activity & transaction logs

### 6.3 Admin Dashboard

- Authenticated staff
- Manage clients
- Manage menus, packs, subscriptions
- Manage deliveries
- Respond to enquiries
- Monitor system activity

Each surface has its own frontend entry point but shares backend APIs.

---

## 7. Architecture at a Glance

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

## 8. BalanceGuard (Security Contract)

**BalanceGuard** is the mandatory security wrapper for Balance Kitchen.

### 8.1 What BalanceGuard Enforces

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

### 8.2 Identity & Actor Model

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

### 8.3 Error Semantics (Locked)

- `AUTH_REQUIRED` → no valid session
- `AUTH_INVALID` → invalid credentials
- `FORBIDDEN` → authenticated but not authorized

Error semantics must remain consistent across the system.

### 8.4 Non‑Negotiable Rule

> **Every HTTP route must be wrapped by BalanceGuard.**

WebSocket connections must authenticate and authorize during the handshake and per event.

---

## 9. Backend Server Structure

The backend lives under:

```folder
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
- Route composition: server route files may import module route registrars (e.g. `modules/*/transport/http/routes/*.routes.ts`) to register module-owned endpoints into the canonical `Router`.

---

## 10. Shared Toolkit

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

## 11. Design System & Accessibility

### 11.1 Design Tokens

- All styling is driven by tokens
- Tokens live in `balance_kitchen_tokens.md`
- No hard‑coded colors, spacing, shadows, or radii

### 11.2 CSS Modules (Strict)

- CSS Modules are mandatory for site styling
- `noUncheckedIndexedAccess` is enforced
- Class access **must** use a safe helper (`mustClass`)
- Missing CSS classes must fail fast

### 11.3 Accessibility Rules

- Semantic HTML first
- Keyboard navigation for all interactive elements
- Visible focus states
- Correct ARIA usage
- Respect `prefers‑reduced‑motion`

Accessibility is **not optional**.

---

## 12. Testing Philosophy

Testing is a core requirement.

### 12.1 Expectations

- Domain logic must be unit tested
- Application use‑cases must be tested
- HTTP & WS adapters must be integration tested
- Stripe webhooks must be tested with fixtures

### 12.2 Rules

- Tests live under `/tests/**`
- Tests mirror source structure
- No production secrets in tests

---

## 13. Documentation Is Part of the System

### 13.1 Mandatory Update Rule

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

### 13.2 Source of Truth

If code and documentation disagree:

> **The documentation wins.**

---

## 14. Governance Rules (Absolute)

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

## 15. Compliance & Audit Alignment

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

## 16. Final Statement

Balance Kitchen is designed to be:

- Secure
- Understandable
- Scalable
- Maintainable
- Framework-independent

All contributors (human or AI) are expected to follow this document exactly.
