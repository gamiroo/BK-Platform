# balance_kitchen_toolkit.md — Toolkit & Utilities Specification

> **Canonical toolkit document** for Balance Kitchen (BK).
>
> BK is built **framework-free**:
>
> - **Backend:** TypeScript + Node.js (native `http` + WebSockets)
> - **Frontend:** TypeScript + HTML + CSS Modules

❌ Do not reuse /api/auth/login for admin authentication
❌ Do not infer role from UI or route
❌ Do not share session cookies across surfaces

>
> This toolkit defines the internal libraries/utilities that must exist to keep the system secure, consistent, testable, and scalable.

Authoritative companion documents:

- `balance.md`
- `balance_kitchen_architecture.md`
- `balanceguard.md`
- `balanceguard_structure.md`
- `balance_kitchen_schema.md`
- `balance_kitchen_tokens.md`

---

## 0. Non-Negotiables

1. Cross-cutting concerns live **only** in `src/shared/`.
2. `src/shared/**` must never import from `src/modules/**`.
3. `src/modules/**` may import from `src/shared/**`.
4. **Every HTTP route must be wrapped by BalanceGuard.**
5. WebSockets must apply **WSGuard** (Origin + auth + per-event validation/authz/rate limiting).
6. No ad-hoc helpers outside this toolkit.

---

## 1. Purpose

The BK toolkit provides reusable primitives for:

- HTTP server bootstrapping and routing
- Request context, logging, and correlation
- **BalanceGuard security enforcement** (HTTP) + **WSGuard primitives** (WebSockets)
- Input validation, body limits, and safe parsing
- Error normalization and safe client responses
- Database access and transactions
- Stripe integration and webhook hardening
- Realtime chat/events broadcast primitives
- Frontend HTTP/WS clients + accessibility helpers

---

## 2. Canonical Toolkit Placement

```text
src/shared/
  config/
  logging/
  errors/
  validation/
  http/
  security/
    balanceguard/
    wsguard/
  db/
  stripe/
  realtime/
  utils/
  theme/

src/frontend/
  lib/
  site/
  client/
  admin/
```

---

## 3. Configuration Toolkit (`src/shared/config`)

### Files

- `env.ts` — typed environment loader/validator (fail fast)

Rules:

- No `process.env.*` usage outside `env.ts`.
- Environment must explicitly configure:
  - Stripe secrets
  - session secret(s)
  - database connection
  - CORS allowlists
  - trusted proxy CIDRs
  - security header/CSP toggles

---

## 4. Logging Toolkit (`src/shared/logging`)

### logger Files

- `logger.ts` — Pino base logger
- `request-context.ts` — request-scoped logger/context
- `security-logger.ts` — structured security events

Required fields (server logs):

- `request_id`
- `actor` (anonymous | client | admin | system)
- `route` or `event`
- `ip`
- `status`
- `duration_ms`

Redaction:

- Use `src/shared/utils/redact.ts`.
- Never log passwords, cookies, tokens, Stripe secrets, or raw webhook bodies.

---

## 5. Error Toolkit (`src/shared/errors`)

### Error Files

- `error-codes.ts` — canonical error codes
- `app-error.ts` — typed error (code, status, metadata)
- `normalize-error.ts` — unknown → AppError
- `http-error-response.ts` — AppError → JSON response

Rules:

- Never leak stack traces in production responses.
- Always include `request_id` in error payload.

---

## 6. Validation & Parsing Toolkit (`src/shared/validation`)

### File Structure

- `parse-json.ts` — safe JSON parsing + size limits
- `schema.ts` — schema helpers
- `validate.ts` — validation entrypoint

Rules:

- Validate at transport boundaries.
- Use-cases only accept validated input.
- Enforce per-route body limits.

---

## 7. HTTP Toolkit (`src/shared/http`)

### File Structure

- `headers.ts` — security headers policy
- `responses.ts` — json/noContent helpers
- `cookies.ts` — cookie helpers (HttpOnly/SameSite/Secure)
- `cors.ts` — explicit CORS allowlist
- `error-handler.ts` — safe error normalization integration

Rules:

- Never use `*` for credentialed CORS.
- Apply security headers on every response.
- Provide safe defaults for cache control on sensitive routes.

---

## 8. Security Toolkit — BalanceGuard (`src/shared/security/balanceguard`)

BalanceGuard is the mandatory security wrapper for all HTTP routes.

### File Structure (canonical)

```text
src/shared/security/balanceguard/
  balanceguard.ts
  types.ts
  ip.ts
  origin.ts
  csrf.ts
  identity.ts
  authz.ts
  sessions.ts
  rate-limit.ts
  errors.ts
```

### Responsibilities

- request_id creation + request context
- trusted proxy/IP extraction
- rate limiting
- session auth + identity derivation
- RBAC authorization (deny-by-default)
- CSRF protection for unsafe methods
- Origin enforcement
- CORS enforcement
- security headers
- error normalization
- structured security logging

---

## 9. WebSocket Security Toolkit — WSGuard (`src/shared/security/wsguard`)

WSGuard applies BalanceGuard principles to WebSockets.

### File structure (canonical)

```text
src/shared/security/wsguard/
  ws-auth.ts
  ws-origin.ts
  ws-rate-limit.ts
  ws-validate.ts
  ws-authz.ts
  ws-backpressure.ts
  types.ts
```

### Responsibilities

- Origin allowlist enforcement at handshake
- session authentication at handshake
- per-event payload validation
- per-event authorization (room/thread membership)
- per-event rate limiting + spam controls
- backpressure and outbound queue limits

---

## 10. Database Toolkit (`src/shared/db`)

### File structure

```text
src/shared/db/
  client.ts
  drizzle.ts
  tx.ts
  columns.ts
  schema/
    core.ts
```

Rules:

- DB client is centralized.
- No SQL in transports.
- Use transactions for multi-write operations (`tx.ts`).
- Cross-module tables live in `schema/core.ts`.

---

## 11. Stripe Toolkit (`src/shared/stripe`)

### Files

- `stripe-client.ts` — Stripe SDK init
- `webhook.ts` — raw body reading + signature verification
- `idempotency.ts` — event id persistence helpers
- `events.ts` — event routing map

Rules:

- Webhooks must be signature-verified.
- Webhook handling must be idempotent (`billing_stripe_events`).
- Never log raw webhook bodies.

---

## 12. Realtime Toolkit (`src/shared/realtime`)

### Files

- `events.ts` — typed realtime event map
- `broadcast.ts` — broadcast abstraction
- `rooms.ts` — room/thread membership helpers

Scaling seam:

- Start with `InMemoryBroadcast`.
- Add `RedisPubSubBroadcast` later without changing module code.

---

## 13. Utilities (`src/shared/utils`)

Allowed utilities:

- `ids.ts` (UUID)
- `time.ts`
- `redact.ts`
- `assert.ts`

Rules:

- Keep utilities pure.
- No env access.
- No side effects.

---

## 14. Theme Toolkit (`src/shared/theme`)

Canonical files:

- `tokens.css`
- `globals.css`
- `motion.css`

Rules:

- Styling must be token-driven only.
- Theme switching uses:

```html
<html data-theme="light|dark">
```

No JS theme branching.
--bk-duration-* and --bk-ease-* are required

---

## 15. Frontend Toolkit (`src/frontend/lib`)

### 15.0 CSS Modules — Strict Access (Mandatory)

Because `noUncheckedIndexedAccess: true` is enforced across all frontend surfaces, **direct access to CSS Modules is forbidden**.

CSS class access must be **fail-fast and type-safe**.

Canonical helper:

- `mustClass(styles, className)`

Rules:

- CSS Modules must be typed as `Record<string, string>`
- Accessing `styles.foo` directly is not permitted
- Missing class names must throw immediately
- `string | undefined` is never allowed to reach DOM rendering
- This rule applies to **site**, **client**, and **admin** surfaces

Canonical implementation location:

```text
src/frontend/shared/css-modules.ts
```

### 15.1 CSS Modules strict access helper (`mustClass`, `cx`)

Because `noUncheckedIndexedAccess: true` is enforced, CSS Modules access must be safe and fail-fast.

Canonical location (per architecture):

```text
src/frontend/site/shared/css-modules.ts
```

### Required files

- `http-client.ts` — fetch wrapper with:
  - timeouts
  - safe JSON parsing
  - standardized errors
  - credential handling for cookie sessions
- `ws-client.ts` — reconnect + backoff
- `session.ts` — session state helpers
- `a11y/` — focus management utilities

Rules:

- No direct `fetch()` usage scattered through UI.
- Use the wrapper.
- Accessibility helpers are mandatory for interactive UI.

### App Shell (Frontend)

Each frontend surface (site / client / admin) may define an **App Shell** responsible for:

- Persistent layout (header, navigation, identity context)
- Rendering authenticated user context (name, avatar, credits)
- Wrapping routed page content

Rules:

- App shells are surface-owned
- App shells accept an `Actor` and rendered page content
- App shells must not perform data fetching
- App shells must be token-only styled

Canonical location (per surface):

src/frontend/client/shared/app-shell.ts
src/frontend/admin/shared/app-shell.ts

### Actor-aware UI

Frontend UI may adapt based on the current Actor.

Rules:

- Actor is derived exclusively from `/api/auth/me`
- HTTP 200 does not imply authentication
- UI must treat `kind: "anonymous"` explicitly
- Role checks must be deny-by-default

Allowed UI adaptations:

- Header identity display
- Route gating
- Role-aware redirects

### Surface Routing & Cross-Origin Navigation

Each surface owns its own router and navigation logic.

Rules:

- Site, client, and admin may run on separate origins/ports
- Navigation between surfaces uses full URLs when required
- SPA routing is surface-local only
- Auth cookies are shared at the domain level where applicable

Accessibility helpers under `src/frontend/lib/a11y/` are mandatory for:

- Focus trapping
- Focus restoration
- Modal/menu interactions
- Keyboard-only navigation

All interactive UI must use these helpers where applicable.


---

## 15A. UI Component Inventory (Canonical)

Balance Kitchen maintains a **single, authoritative UI component inventory** to prevent fragmentation across:

- Marketing site
- Client dashboard
- Admin dashboard

This toolkit is the **source of truth for what UI components are allowed to exist**.

### Governance rules

1. **If it’s not listed here, it must not be introduced.**
2. Components must be **token-driven** (see `balance_kitchen_tokens.md`).
3. Components must be **accessible by default**.
4. Behaviour remains consistent; tone is contextual per surface.
5. New components require documentation + a11y review + tests.

### Canonical placement (frontend)

```text
src/frontend/
  components/
    ui/
    patterns/
  site/
  client/
  admin/
```

---

## 16. Server Operational Defaults

In `src/server/http/server.ts`:

- request timeout
- header timeout
- keep-alive tuning
- graceful shutdown hooks

These must be documented and testable.

---

## 17. Testing Toolkit

```text
tests/helpers/
  factories/
  http/
  db/
  stripe/
  realtime/
```

Rules:

- Tests mirror source structure.
- No production secrets in tests.
- Stripe tests use fixtures.

---

## 18. Summary

This toolkit defines the required internal library surface for BK.

All current and future BK code must conform to this toolkit.

