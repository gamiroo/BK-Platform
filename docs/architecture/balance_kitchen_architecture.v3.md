# balance_kitchen_architecture.md — Architecture & System Structure

> **Canonical architecture document** for Balance Kitchen (BK).
>
> BK is built **framework-free by design**:
>
> - **Backend:** TypeScript + Node.js (native `http` + WebSockets)
> - **Frontend:** TypeScript + HTML + DOM + CSS Modules
>
> This document defines **DDD boundaries**, **transport rules**, **where code must live**, and the **business-driven architectural invariants** that must not be violated.

Related documents:

- `balance.md`
- `balance_kitchen_business_model.md`
- `balance_kitchen_toolkit.md`
- `balanceguard.md`
- `balanceguard_structure.md`
- `balance_kitchen_schema.md`
- `balance_kitchen_tokens.md`
- `devops_setup.md` (trunk-based development, CI/CD, migrations, release management)

---

## 0. Status & Change Log

**Status:** Approved (v3)

**What changed in v3:**

- Aligned architecture with `balance.md` (v3) and the updated business model
- Clarified **packs as the economic anchor** and **subscriptions as entitlements**
- Added **subscription pause/cancel policy** as an application invariant (packs govern subscription validity)
- Introduced **preset-driven ordering** (percentage-based layouts) as a first-class Ordering concept
- Clarified **credit classes** (purchased vs earned) and refund implications
- Clarified chat evolution: future **site chat funnel** as primary relationship + gamification surface

---

## 1. Non-Negotiables (Absolute)

1. **DDD boundaries must be respected at all times.**
2. **No domain or business logic** in transports (HTTP routes, WS handlers) or UI.
3. **Every HTTP route must be wrapped by BalanceGuard.**
4. WebSockets must enforce **WSGuard principles** (origin, auth, authz, validation, rate limiting, backpressure).
5. Cross-cutting concerns live **only** in `src/shared/`.
6. Styling uses **tokens only** (see `balance_kitchen_tokens.md`).
7. Frontend is **framework-free** — no React, no Next.js.
8. Surfaces are deployed separately (**Option A is canonical**):
   - marketing/site, client, and admin are separate frontend builds
   - the backend is API + WS only (no static/SPAs served in production)
9. **CORS + origin allowlists are mandatory** and enforced early.

---

## 2. System Surfaces

Balance Kitchen has **three primary user-facing surfaces**:

- **site**
  - Public marketing surface (anonymous)
  - No authentication or sessions
  - Public interaction includes:
    - enquiries
    - **public chat widget (anonymous, rate-limited)**

### Temporary External Services (Site Surface)

For the initial public release, BK uses external Zoho services as temporary infrastructure:

- **Zoho CRM (Leads)** receives marketing enquiries from the site via the BK API.
- **Zoho Chat widget** is used for public-site chat.

These are **temporary** and will be replaced by internal modules:

- **BalanceCRM** (internal enquiry + lead + pipeline management)
- **BalanceChat** (internal realtime chat platform)

Integration rule (non-negotiable):

- The **site frontend never talks to Zoho directly**.
- All Zoho communication is **server-side only** via the `api` surface.

- **client** — authenticated client dashboard
- **admin** — authenticated admin / staff dashboard

### 2.1 Purchase Prerequisite (Business Rule)

Per the business model, clients must have an active entitlement before ordering meals.

**Authoritative interpretation (v3):**

- Packs represent the economic anchor (purchased meals / purchased credits)
- Subscription entitlements are only valid while pack balance remains

Enforcement belongs to:

- **Ordering application layer** (always)
- **Client application layer** (for UI guardrails)

Billing does not enforce this; it only records payment facts and dispatches reconciled events.

### 2.2 Responsibilities by Surface (Security-First)

Per `balanceguard.md` and Option A deployment:

- **site**
  - Public marketing only
  - **No auth routes** (no login/logout/me)
  - Public interactions are **request access** and **anonymous chat**

- **client**
  - Owns client authentication routes (`/api/auth/*` for client)
  - Owns session-bearing client APIs

- **admin**
  - Owns admin authentication routes (admin-scoped auth / RBAC)
  - Owns privileged admin APIs

> Rationale: marketing remains anonymous and low-risk; authenticated surfaces own their auth edges.

### 2.3 Deployment Topology (Option A — Canonical)

Each surface:

- Is built and deployed **independently** (separate Vite builds)
- Has its own **origin** (recommended)
- Communicates with the backend over **HTTP + WebSockets**

Canonical example topology:

- `https://site.<domain>`   → marketing app
- `https://client.<domain>` → client app
- `https://admin.<domain>`  → admin app
- `https://api.<domain>`    → backend HTTP API
- `wss://api.<domain>`      → backend WebSockets

#### 2.3.1 Vercel Implementation (Canonical)

BK’s canonical deployment uses **4 Vercel projects** that map 1:1 to the architecture surfaces:

- `site`   — Vite build (static)
- `client` — Vite build (static)
- `admin`  — Vite build (static)
- `api`    — Vercel Serverless Functions (Node.js)

##### 2.3.1.1 Environment Variables & Secrets (Canonical)

Rule: **all secrets live in the `api` project only**.

- `site`, `client`, `admin` are static frontends and MUST NOT contain secrets.
- Server-only credentials (DB, Redis, third-party OAuth/CRM, Stripe secrets) MUST be set on:
  - Vercel Project: `api`
  - Environment scopes as appropriate (Production vs Preview)

Examples of **server-only secrets** (api project only):

- `DATABASE_URL`
- `REDIS_URL`
- `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_DATA_CENTER`
- Stripe secret keys + webhook secrets (when billing is enabled)

##### 2.3.1.2 Vercel Projects (Declared & Locked)

Balance Kitchen uses **exactly four (4) Vercel projects**, each mapped 1:1 to a system surface.

These projects are **already provisioned and active**.

| Vercel Project | Git Branch | Responsibility |
| ---------------- | ----------- | ---------------- |
| `site` | `main` | Public marketing site (static Vite build) |
| `client` | `main` | Authenticated client dashboard (static Vite build) |
| `admin` | `main` | Authenticated admin dashboard (static Vite build) |
| `api` | `main` | Backend HTTP + WebSocket API (Serverless Functions) |

Rules (locked):

- All four projects deploy **from `main` only**
- CI must pass before deployment
- Each project has **isolated environment variables**
- Only the `api` project may contain secrets
- Frontend projects (`site`, `client`, `admin`) are static and secret-free

This deployment topology is **canonical** and must not be altered without an explicit architecture revision.

### Zoho CRM (Temporary — until BalanceCRM)

Balance Kitchen integrates with **Zoho CRM** for **initial website enquiries only**.

**Scope:**

- Module: `enquiry`
- Object: `Leads`
- Purpose: capture inbound marketing enquiries prior to account creation

**Operational Rules:**

- Enquiry submission is **fail-closed**
  - If Zoho write fails, the enquiry is rejected
  - No local persistence or retry queue is used at this stage
- Minimal fields are sent:
  - `Last_Name` (required by Zoho)
  - `Email`
  - `Lead_Source`
  - `Description` (free-text message)

**Authentication:**

- OAuth2 refresh-token flow
- Access token cached in-memory per runtime instance
- Cold starts safely re-refresh tokens

**Runtime Placement:**

- Executed server-side only
- Secrets are stored in the **api** runtime environment only
- No Zoho credentials are exposed to frontend surfaces

**Temporary Integration Notice**
Zoho CRM is a **temporary external dependency**.
It will be replaced by **BalanceCRM** once the internal CRM bounded context is implemented.
No domain logic may depend on Zoho-specific response shapes or field semantics.

Frontend projects may only hold non-sensitive “public configuration” such as:

- API base URL
- surface origin URLs
- feature flags safe to expose

Local development:

- `.env.local` may include secrets only for local runs.
- Never commit `.env.local`.

Critical runtime invariant (Vercel Functions):

- API entrypoints MUST use Web Handler export format:
  - `export default { async fetch(request) { return Response } }`

This is required to ensure requests always terminate correctly in the Vercel runtime.
A wrong handler shape can lead to functions hanging and timing out.

The API surface is purely HTTP/WS and must not serve SPA assets in production.
Frontends remain independent static deployments.

---

### 2.4 Cross-Origin Contract (Mandatory)

Because frontends and backend are cross-origin:

- Frontend requests must use `credentials: "include"` when sessions apply
- Backend cookies must be:
  - `HttpOnly`
  - `Secure` (production)
  - `SameSite=None` (production cross-origin)
- Backend must apply **CORS allowlists per surface**

CORS modes are explicit and must be declared per route via BalanceGuard options:

- `site`
- `client`
- `admin`

---

## 3. Chat Surfaces & Interaction Model

Balance Kitchen chat spans multiple surfaces with distinct trust models.

### 3.1 Public Site Chat (Anonymous)

- Lives on the **site** surface
- Actor is always `anonymous` (no sessions)
- Used for new customer interactions
- Must be aggressively rate-limited
- May be stored as an admin inbox message when offline

**Temporary Chat Notice (Zoho SalesIQ / Zoho Chat)**
The marketing site may embed Zoho’s chat widget as a **temporary** solution for public enquiries and live support.

Rules:

- The widget is UI-only (no secrets in the site build)
- It must not become a dependency for core product workflows or identity
- It will be replaced by **BalanceChat** once the internal chat system is implemented

Guest session (site widget):

- Use an ephemeral UUID to track a visitor session (no login)
- Expire after inactivity (recommended: 1 hour)
- Use for abuse control (rate limits, spam patterns) without storing message bodies in logs

### 3.2 Authenticated Chat (Client/Admin)

- Lives on the **client** and **admin** surfaces only
- Requires session-based actor resolution and RBAC
- Supports structured chat spaces per `chat_module.md`:
  - main lobby (global)
  - sub-lobbies (account-manager scoped)
  - rooms (invite-only)

All authenticated chat requires session-based identity and RBAC.

### 3.3 Future Direction — Site Chat Funnel (Primary Entry)

A future internally built, **Discord-style chat system** will become the primary entry point for prospective customers via a structured chat funnel on the marketing site.

This funnel is a key surface where **gamification experiences are delivered and enhanced**.

---

## 4. High-Level Layering (DDD)

```text
Frontend (site / client / admin)
        │
        ▼
Transport Layer (HTTP + WebSocket)
        │
        ▼
Application Layer (use-cases)
        │
        ▼
Domain Layer (business rules)
        │
        ▼
Infrastructure (DB, Stripe, Email, IO)
```

### 4.1 Layer Rules

- **Transport**
  - Parses input
  - Applies BalanceGuard / WSGuard
  - Calls a use-case
  - Returns a response

- **Application (use-cases)**
  - Orchestrates domain logic
  - Handles workflows and policies
  - Coordinates modules via contracts/events

- **Domain**
  - Owns invariants and business rules
  - Is framework-agnostic

- **Infrastructure**
  - DB repositories
  - Stripe / email / external providers

---

## 5. Business-Driven Architectural Invariants

These invariants must be modeled as explicit policies/state machines and enforced in the **application layer**.

### 5.1 Packs Are the Economic Anchor

- Packs represent **purchased meals** (or pack-derived purchased credits)
- Packs are exhaustible
- Packs determine whether a customer is operationally “active” for ordering

### 5.2 Subscriptions Are Entitlements, Not Inventory

Subscriptions define service level entitlements:

- preset meal layouts
- ingredient access (tier gating)
- urgency allowances
- support level (AMXperience)

**Critical rule (locked):**

- A subscription is **active only while meals/pack balance remain**
- When meal balance reaches zero:
  - subscription auto-pauses
  - after 7 days, subscription cancels if not reactivated

This rule must be enforced by the **Subscriptions** application layer and validated by **Ordering**.

### 5.3 Credits Are a Ledger (Two Classes)

Credits (when implemented) are the canonical entitlement ledger.

Two conceptual classes exist:

- **Purchased credits** (pack-derived)
  - may be refundable under defined conditions
- **Earned credits** (gamification-derived)
  - never refundable

**Rule:** Credits are factual state and must never be gamified visually.

### 5.4 Preset-Driven Ordering Is the Default Experience

Ordering must be optimized for low cognitive load.

For eligible tiers:

- customers maintain **preset dish layouts** (percentage-based distributions)
- weekly ordering applies presets automatically
- per-meal overrides are optional and tier-gated

**Ownership split:**

- Preset definition and constraints live in **Customer Preferences**
- Preset application, allocation, and enforcement live in **Ordering**

This separation is mandatory and enforced by module boundaries.

### 5.5 Production Cutoff Is the Operational Lock

Weekly orders transition from mutable to immutable at a **kitchen-defined production cutoff**.

- Window close ends customer interaction
- Production cutoff ends operational flexibility
- After cutoff, changes are governed exclusively by the Operational Failure Model

This prevents UI-driven or late-stage operational instability.

### 5.6 Delivery Discipline Is an Architectural Invariant

BK uses trunk-based development with strict CI gates and controlled releases.

- `main` is the trunk; branches are short-lived
- CI enforces type safety, linting, tests, and builds
- Staging deploys from `main`
- Production deploys from signed version tags (`vX.Y.Z`)
- Database migrations are forward-safe and backwards-compatible across one release window

These rules are defined in `devops_setup.md` and are non-negotiable.

### 5.7 Database Environments & Isolation (Operational Invariant)

Balance Kitchen uses **Neon (PostgreSQL)** with explicit, enforced environment isolation.

Database branches:

- **Production**
  - Neon branch: `main`
  - Connected to the `production` environment only
- **Development**
  - Neon branch: `dev`
  - Forked from `main` at creation time
  - Used exclusively for local development and non-production testing

Key invariants:

- Database branches are **independent after creation**
- No automatic syncing occurs between `dev` and `main`
- All schema and data divergence is intentional and explicit
- Production data must never be accessed from development environments

### 5.7.1 Connection Strategy (Canonical)

The application reads a **single canonical database variable**:

- `DATABASE_URL`

Rules:

- No environment-specific variants (`DATABASE_URL_DEV`, `DATABASE_URL_PROD`) are permitted in application code
- Environment selection is handled exclusively by the deployment platform
- The application code is environment-agnostic by design

### 5.7.2 Trust Boundary

PostgreSQL is part of Balance Kitchen’s **core trust boundary**.

Therefore:

- Database constraints are authoritative
- Application logic must not attempt to bypass or duplicate DB invariants
- Migrations must be forward-safe and reversible within one release window

---

## 6. Canonical Repository Structure

> Folder names may grow, but **boundaries must not change**.

```text
src/
  shared/
    config/
      env.ts
    logging/
    errors/
    validation/
    http/
      headers.ts
      responses.ts
      cors.ts
      cookies.ts
    security/
      balanceguard/
      wsguard/
    db/
      schema/
        core.ts
      columns.ts
      client.ts
      drizzle.ts
      tx.ts
    stripe/
    realtime/
    utils/
    theme/
      tokens.css
      globals.css
      motion.css

  server/
    http/
      server.ts
      router.ts
      routes/
        site.routes.ts
        client.routes.ts
        admin.routes.ts
        webhooks.routes.ts
    websocket/
      ws-server.ts
      ws-router.ts

  frontend/
    site/
      index.ts
      pages/
      components/
      shared/
        css-modules.ts
    client/
      index.ts
      pages/
      components/
    admin/
      index.ts
      pages/
      components/
    lib/
      http-client.ts
      ws-client.ts
      session.ts
      a11y/

  modules/
    <module>/
      domain/
      application/
      infrastructure/
        db/
          schema.ts
          repository.ts
        providers/
      transport/
        http/
          routes.ts
        ws/
          events.ts

tests/
  shared/
  modules/
  server/
```

---

## 7. HTTP Architecture

### 7.1 Router Model (Framework-Free)

- `server.ts` boots the Node HTTP server
- `router.ts` matches **method + path only**
- `routes/*.routes.ts` register route groups

The router:

- Does **not** parse bodies
- Does **not** enforce auth
- Does **not** handle errors

### 7.2 Thin Adapter Rule (HTTP)

HTTP handlers **must**:

1. Declare BalanceGuard options
2. Parse and validate input
3. Call a use-case
4. Return standardized JSON

HTTP handlers **must not**:

- Call the database directly
- Embed business logic
- Implement auth, CSRF, CORS, or headers

### 7.3 API Versioning (Recommended)

For long-lived stability, prefer versioned API paths:

- `/api/v1/site/...`
- `/api/v1/client/...`
- `/api/v1/admin/...`

---

## 8. WebSocket Architecture

Realtime is handled via native WebSockets.

- `ws-server.ts` boots the WS server
- `ws-router.ts` dispatches events

### 8.1 WSGuard (Mandatory)

Every WebSocket connection must:

- Enforce origin allowlist on handshake
- Authenticate using the same session model
- Authorize per event
- Validate payloads
- Apply per-event rate limits
- Enforce backpressure

Implementation primitives live in:

```text
src/shared/security/wsguard/
```

### 8.2 Standard Event Envelope (Recommended)

Realtime and domain events should use a consistent envelope:

- `type` (string)
- `payload` (object)
- `metadata`:
  - `timestamp` (ISO8601)
  - `request_id?`
  - `correlation_id?`
  - `actor`

This improves traceability across: invite → join → message → moderation.

---

## 9. Module Boundaries

Each module lives in `src/modules/<module>/` and follows the DDD layering model:

- `domain/` — entities, value objects, policies, invariants (no IO)
- `application/` — use-cases orchestrating domain + repositories
- `infrastructure/` — external adapters (DB repos, provider SDKs)
- `transport/http/` — thin adapters only (BalanceGuard wrapped)
- `transport/ws/` — thin adapters only (WSGuard principles applied)

**Rule:** No business logic in transport. All security/cross-cutting concerns live in `src/shared/` only.

### 9.0 Database as a Trust Boundary (Canonical)

PostgreSQL is part of BK’s core trust boundary.

The authoritative schema is defined in:

- `balance_kitchen_schema.md`

All domain modules must treat database constraints (FKs, uniques, invariants) as non-negotiable correctness guarantees.

Schema and migrations are governed together:

- schema changes require migrations
- migrations must follow safe rollout patterns (additive → backfill → switch reads → cleanup)
- `balance_kitchen_schema.md` must be updated alongside migrations

### 9.1 Module Index (Canonical Specs)

The following module specs are canonical and must be referenced when implementing each module:

- Identity → `identity_module.md`
- Enquiry → `enquiry_module.md`
- Customer Preferences → `customer_preferences_module.md`
- Chat → `chat_module.md`
- Billing (Stripe Integration Core) → `billing_module.md`
- Packs → `packs_module.md`
- Subscriptions → `subscriptions_module.md`

> If a module has a spec document, the implementation must conform to it.
> If a module does not yet have a spec, do not invent structure — create the spec first.

---

## 10. Core Module Responsibilities (Expanded)

### 10.1 Identity Module

**Owns:**

- users, accounts, roles
- session identity / actor resolution inputs
- domain constraints around role membership

**Does not own:**

- rate limiting, headers, CSRF, origin enforcement (BalanceGuard/shared)
- payments (Billing)

**Primary integrations:**

- BalanceGuard actor resolution
- client/admin surface access control

---

### 10.2 Enquiry Module

**Owns:**

- marketing enquiry submissions
- enquiry status flow (received → contacted → converted)
- contact/audit events around the enquiry lifecycle

**Does not own:**

- account activation/session issuance (Identity)
- payments (Billing)

---

### 10.3 Customer Preferences Module

**Owns:**

- preference profiles + deterministic evaluation rules
- allergen/exclusion/like/dislike rules
- preference audit events
- preset definitions and constraints (profile-side)

**Does not own:**

- menu composition logic (Menu/Meals module)
- weekly ordering window logic (Ordering module)

---

### 10.4 Chat Module

**Owns:**

- conversations, participants, roles, messages
- message moderation + auditability
- invitation and permission model (per spec)

**Does not own:**

- general auth/session implementation (Identity/BalanceGuard)
- websocket transport security primitives (shared)

---

### 10.5 Billing Module (Stripe Integration Core)

Billing is the only module that speaks to Stripe.

**Owns:**

- Stripe SDK initialization + usage
- webhook signature verification (`stripe-signature` + raw body)
- webhook idempotency (`billing_stripe_events`)
- canonical transaction ledger (`billing_transactions`, line items)
- routing Stripe events into neutral billing facts, then dispatching domain meaning changes

**Does not own:**

- pack meaning/entitlements (Packs)
- subscription lifecycle meaning/state machine (Subscriptions)
- credits ledger (Credits, future)

**Canonical webhook entry:**

- `POST /webhooks/stripe/billing`

---

### 10.6 Packs Module

**Owns:**

- pack catalogue
- pack purchases (domain record)
- pack lifecycle events
- mapping from “paid purchase” → entitlement grant (often via Credits ledger)

**Integrates with Billing:**

- Packs initiates checkout (via its use-case calling Billing helpers)
- Billing reconciliation triggers Packs handlers to finalize `PAID`, handle refunds, etc.

---

### 10.7 Subscriptions Module

**Owns:**

- subscription plans
- customer subscription lifecycle state machine
- subscription events + auditability
- mapping from “invoice paid” → entitlement grant per interval (often via Credits ledger)
- enforcement of subscription pause/cancel policy (packs govern subscription validity)

**Integrates with Billing:**

- Subscriptions initiates checkout (via its use-case calling Billing helpers)
- Billing reconciles invoices/subscription updates and dispatches to Subscriptions handlers

---

### 10.8 Credits Module (Future)

Credits is the recommended canonical ledger for entitlements.

**Owns:**

- append-only credit ledger
- balance projections (derived)
- reversible adjustments tied to billing transactions/refunds
- separation of credit classes (purchased vs earned)

Packs/Subs should grant entitlements into Credits once implemented.

---

## 11. Ordering, Menu, Delivery & Notifications (Future Bounded Contexts)

These bounded contexts are required to fully implement the business model.

### 11.1 Menu/Meals

**Owns:**

- dish definitions
- categories
- ingredient option sets (normal vs premium)
- nutrition metadata

### 11.2 Ordering (Canonical)

**Spec:** `ordering_module.md`

**Owns:**

- weekly ordering window state
- order state machine
- enforcement of entitlements (packs/subscriptions/credits)
- preset-driven allocation logic (percentage-based)
- optional per-meal overrides (tier-gated)
- cut-off exception handling (manual now, vouchers later)

### 11.3 Delivery (In-House)

**Owns:**

- delivery runs
- driver assignments
- tracking events and status timelines

### 11.4 Notifications

**Owns:**

- email/SMS/in-app notification scheduling
- audit events for sends and failures

**Rule:** Do not implement any of these without a canonical module spec document.

---

## 12. Shared Layer Rules

`src/shared/` owns:

- Environment (`config/env.ts`)
- Logging (Pino)
- Error normalization
- Validation and body parsing
- HTTP helpers
- BalanceGuard (HTTP)
- WSGuard primitives
- DB client and core schema
- Stripe client and webhook helpers
- Design tokens and global CSS

---

## 13. Frontend Architecture

### 13.1 Entry Points

- `frontend/site/index.ts`
- `frontend/client/index.ts`
- `frontend/admin/index.ts`

### 13.2 Styling Rules

- CSS Modules only
- Token-driven values only
- `mustClass()` required for class access

Theme switching:

```html
<html data-theme="light|dark">
```

### 13.3 Networking

All frontend networking must go through:

- `frontend/lib/http-client.ts`
- `frontend/lib/ws-client.ts`

No ad-hoc `fetch()` calls in UI code.

---

## 14. Authentication Surfaces

Balance Kitchen uses **surface-isolated authentication**.

Surfaces:

- `client` – customer-facing dashboard
- `admin` – internal administration dashboard

Each surface:

- Has its own login/logout/me endpoints
- Uses its own session cookie
- Enforces role constraints at login time

```text
Browser
 ├── Client App → /api/auth/login       → bk_client_session
 └── Admin App  → /api/admin/auth/login → bk_admin_session
```

---

## 15. Security Architecture

BalanceGuard + WSGuard are mandatory.

- See `balanceguard.md` for the security contract.
- See `balanceguard_structure.md` for the implementation map.

### 15.1 Secure Chat Mode (Future Subsystem)

Secure Chat Mode (e.g. end-to-end encrypted chat) is intentionally **out of scope** for the default chat system.

If introduced, it must:

- Exist as a **separate module** (e.g. `modules/secure-chat/`)
- Have its own API surface and threat model
- Not replace or silently modify the existing chat system
- Be explicitly labelled in the UI

The default chat system remains server-trusted and auditable.

---

## 16. Definition of Done (Architecture)

A feature is complete only when:

- Transport is thin
- Use-case owns orchestration
- Domain owns business rules
- Shared owns cross-cutting
- BalanceGuard wraps HTTP
- WSGuard principles apply
- Tests cover success + failure

---

## 17. Summary

This architecture ensures Balance Kitchen remains:

- Secure
- Maintainable
- Scalable
- Auditable
- Framework-independent

All contributors must follow this document exactly.
