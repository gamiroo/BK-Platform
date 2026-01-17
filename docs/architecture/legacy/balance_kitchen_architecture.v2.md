# balance_kitchen_architecture.md — Architecture & System Structure (v2)

> **Canonical architecture document** for Balance Kitchen (BK).
>
> BK is built **framework-free by design**:
>
> - **Backend:** TypeScript + Node.js (native `http` + WebSockets)
> - **Frontend:** TypeScript + HTML + CSS Modules
>
> This document defines **DDD boundaries**, **transport rules**, and **where code must live**.

Related documents:

- `balance.md`
- `balance_kitchen_toolkit.md`
- `balanceguard.md`
- `balanceguard_structure.md`
- `balance_kitchen_schema.md`
- `balance_kitchen_tokens.md`

---

## 0. Non-Negotiables (Absolute)

1. **DDD boundaries must be respected at all times**.
2. **No domain or business logic** in transports (HTTP routes, WS handlers) or UI.
3. **Every HTTP route must be wrapped by BalanceGuard**.
4. WebSockets must enforce **WSGuard principles** (origin, auth, authz, validation, rate limiting).
5. Cross-cutting concerns live **only** in `src/shared/`.
6. Styling uses **tokens only** (see `balance_kitchen_tokens.md`).
7. Frontend is **framework-free** — no React, no Next.js.
8. **Surfaces are deployed separately (Option A)**:
   - marketing/site, client, and admin are separate frontend builds
   - the backend is API + WS only (no static/SPAs served in production)
9. **CORS + origin allowlists are mandatory** and implemented early.

---

## 1. System Surfaces

### Purchase Prerequisite (Business Rule)

Per the BK business model, clients must have an active entitlement before ordering meals:

- Pack purchase grants a one-off entitlement (meals)
- Subscription grants recurring entitlement per billing interval

This rule is enforced by the Ordering/Client application layer using:
- Packs purchase state and/or Credits ledger
- Subscription state and/or Credits ledger

Billing does not enforce this rule; it only records payment facts and dispatches reconciled events.


Balance Kitchen has **three primary user-facing surfaces**:

- **site**
  - Public marketing surface (anonymous)
  - No authentication or sessions
  - Public interaction includes:
    - enquiries
    - **public chat widget (anonymous, rate-limited)**

- **client** — authenticated client dashboard
- **admin** — authenticated admin / staff dashboard

### 1.1 Responsibilities by Surface (Security-First)

Per `balanceguard.md` and the canonical **Option A** deployment model:

- **site**
  - Public marketing only
  - **No auth routes** (no login/logout/me)
  - Only public interaction is **request access** (enquiry)

- **client**
  - Owns **client authentication routes** (`/api/auth/*` for client)
  - Owns session-bearing client APIs

- **admin**
  - Owns **admin authentication routes** (admin-scoped auth / RBAC)
  - Owns privileged admin APIs

> Rationale: marketing remains anonymous and low-risk; authenticated surfaces own their auth edges.

### 1.2 Deployment Topology (Option A — Canonical)

Each surface:

- Is built and deployed **independently** (separate Vite builds)
- Has its own **origin** (recommended)
- Communicates with the backend over **HTTP + WebSockets**

Canonical example topology:

- `https://site.<domain>`   → marketing SPA
- `https://client.<domain>` → client SPA
- `https://admin.<domain>`  → admin SPA
- `https://api.<domain>`    → backend HTTP API
- `wss://api.<domain>`      → backend WebSockets

### 1.3 Cross-Origin Contract (Mandatory)

Because frontends and backend are cross-origin:

- Frontend requests must use `credentials: "include"` when sessions apply
- Backend cookies must be:
  - `HttpOnly`
  - `Secure` (production)
  - `SameSite=None` (production cross-origin)
- Backend must apply **CORS allowlists per surface**

CORS modes are **explicit** and must be declared per route via BalanceGuard options:

- `site`
- `client`
- `admin`

## 1.4 Chat Surfaces & Interaction Model

Balance Kitchen chat spans multiple surfaces with distinct trust models.

### 1.4.1 Public Site Chat (Anonymous)

- Lives on the **site** surface
- Actor is always `anonymous` (no sessions)
- Used for new customer interactions
- Must be aggressively rate-limited
- May be stored as an admin inbox message when offline

Guest session (site widget):
- Use an ephemeral UUID to track a visitor session (no login)
- Expire after inactivity (recommended: 1 hour)
- Use for abuse control (rate limits, spam patterns) without storing message bodies in logs


### 1.4.2 Authenticated Chat (Client/Admin)

- Lives on the **client** and **admin** surfaces only
- Requires session-based actor resolution and RBAC
- Supports structured chat spaces:
  - main lobby (global)
  - sub-lobbies (account-manager scoped)
  - rooms (invite-only)

All authenticated chat requires session-based identity and RBAC.


---

## 2. High-Level Layering (DDD)

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

### Layer Rules

- **Transport**
  - Parses input
  - Applies BalanceGuard / WSGuard
  - Calls a use-case
  - Returns a response

- **Application (use-cases)**
  - Orchestrates domain logic
  - Handles workflows and policies

- **Domain**
  - Owns invariants and business rules
  - Is framework-agnostic

- **Infrastructure**
  - DB repositories
  - Stripe / email / external providers

---

## 3. Canonical Repository Structure

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
    preferences/
      domain/
      application/
      infrastructure/
      transport/
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

## 4. HTTP Architecture

### 4.1 Router Model (Framework-Free)

- `server.ts` boots the Node HTTP server
- `router.ts` matches **method + path only**
- `routes/*.routes.ts` register route groups

The router:
- Does **not** parse bodies
- Does **not** enforce auth
- Does **not** handle errors

### 4.2 Thin Adapter Rule (HTTP)

HTTP handlers **must**:

1. Declare BalanceGuard options
2. Parse and validate input
3. Call a use-case
4. Return standardized JSON

HTTP handlers **must not**:

- Call the database directly
- Embed business logic
- Implement auth, CSRF, CORS, or headers

### 4.3 API Versioning (Recommended)

For long-lived stability, prefer versioned API paths:

- `/api/v1/site/...`
- `/api/v1/client/...`
- `/api/v1/admin/...`

Versioning becomes mandatory before any public API contract is treated as stable.


---

## 5. WebSocket Architecture

Realtime is handled via native WebSockets.

- `ws-server.ts` boots the WS server
- `ws-router.ts` dispatches events

### 5.1 WSGuard (Mandatory)

Every WebSocket connection must:

- Enforce origin allowlist on handshake
- Authenticate using the same session model
- Authorize per event
- Validate payloads
- Apply per-event rate limits
- Enforce backpressure

Implementation primitives live in:

```
src/shared/security/wsguard/
```

### 5.2 Standard Event Envelope (Recommended)

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

## 6. Module Boundaries

Each module lives in `src/modules/<module>/` and follows the DDD layering model:

- `domain/` — entities, value objects, policies, invariants (no IO)
- `application/` — use-cases orchestrating domain + repositories
- `infrastructure/` — external adapters (DB repos, provider SDKs)
- `transport/http/` — thin adapters only (BalanceGuard wrapped)

**Rule:** No business logic in transport. All security/cross-cutting concerns live in `src/shared/` only.

---

### 6.0 Module Index (Canonical Specs)

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

### 6.1 Identity Module

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

### 6.2 Enquiry Module

**Owns:**
- marketing enquiry submissions
- enquiry status flow (received → contacted → converted)
- contact/audit events around the enquiry lifecycle

**Does not own:**
- account activation/session issuance (Identity)
- payments (Billing)

---

### 6.3 Customer Preferences Module

**Owns:**
- preference profiles + deterministic evaluation rules
- allergen/exclusion/like/dislike rules
- preference audit events

**Does not own:**
- menu composition logic (Menu/Meals module if/when added)
- ordering flow (Ordering module if/when added)

---

### 6.4 Chat Module

**Owns:**
- conversations, participants, roles, messages
- message moderation + auditability
- invitation and permission model (per spec)

**Does not own:**
- general auth/session implementation (Identity/BalanceGuard)
- websocket transport security primitives (shared)

---

### 6.5 Billing Module (Stripe Integration Core)

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

### 6.6 Packs Module

**Owns:**
- pack catalogue
- pack purchases (domain record)
- pack lifecycle events
- mapping from “paid purchase” → entitlement grant (often via Credits ledger)

**Integrates with Billing:**
- Packs initiates checkout (via its use-case calling Billing helpers)
- Billing webhook reconciliation triggers Packs handler(s) to finalize `PAID`, handle refunds, etc.

---

### 6.7 Subscriptions Module

**Owns:**
- subscription plans
- customer subscription lifecycle state machine
- subscription events + auditability
- mapping from “invoice paid” → entitlement grant per interval (often via Credits ledger)

**Integrates with Billing:**
- Subscriptions initiates checkout (via its use-case calling Billing helpers)
- Billing reconciles invoices/subscription updates and dispatches to Subscriptions handlers

---

### 6.8 Credits Module (Future)

Credits is the recommended canonical ledger for meal entitlements.

**Owns:**
- append-only credit ledger
- balance projections (derived)
- reversible adjustments tied to billing transactions/refunds

Packs/Subs should grant entitlements into Credits once implemented.

---

### 6.9 Ordering / Menu / Delivery / Notifications (Future)

These modules are referenced by the business model and are expected as future bounded contexts:

- Menu/Meals: meal definitions, ingredients, nutrition metadata
- Ordering: weekly ordering flow, cutoffs, order state machine
- Delivery: delivery runs, driver assignments (in-house), tracking events
- Notifications: email/SMS/in-app notification scheduling + audit

Do not implement these without a canonical module spec document.



---

## 7. Shared Layer Rules

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

## 8. Security Architecture

BalanceGuard + WSGuard are mandatory.

- See `balanceguard.md` for the security contract.
- See `balanceguard_structure.md` for the implementation map.

### 8.1 Secure Chat Mode (Future Subsystem)

Secure Chat Mode (e.g. end-to-end encrypted chat) is intentionally
**out of scope** for the default chat system.

If introduced, it must:

- Exist as a **separate module** (e.g. `modules/secure-chat/`)
- Have its own API surface and threat model
- Not replace or silently modify the existing chat system
- Be explicitly labelled in the UI

The default chat system remains server-trusted and auditable.


---

## 9. Frontend Architecture

### 9.1 Entry Points

- `frontend/site/index.ts`
- `frontend/client/index.ts`
- `frontend/admin/index.ts`

### 9.2 Styling Rules

- CSS Modules only
- Token-driven values only
- `mustClass()` required for class access

Theme switching:

```html
<html data-theme="light|dark">
```

### 9.3 Networking

All frontend networking must go through:

- `frontend/lib/http-client.ts`
- `frontend/lib/ws-client.ts`

No ad-hoc `fetch()` calls in UI code.

---

## 10. Authentication Surfaces

Balance Kitchen uses **surface-isolated authentication**.

Surfaces:
- `client` – customer-facing dashboard
- `admin` – internal administration dashboard

Each surface:
- Has its own login/logout/me endpoints
- Uses its own session cookie
- Enforces role constraints at login time

Browser
 ├── **Client App** → `/api/auth/login` → **bk_client_session**
 └── **Admin App**  → `/api/admin/auth/login` → **bk_admin_session**


---

## 11. Definition of Done (Architecture)

A feature is complete only when:

- Transport is thin
- Use-case owns orchestration
- Domain owns business rules
- Shared owns cross-cutting
- BalanceGuard wraps HTTP
- WSGuard principles apply
- Tests cover success + failure

---

## 12. Summary

This architecture ensures Balance Kitchen remains:

- Secure
- Maintainable
- Scalable
- Auditable
- Framework-independent

All contributors must follow this document exactly.

