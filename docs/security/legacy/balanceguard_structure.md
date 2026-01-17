# balanceguard_structure.md — BalanceGuard File Structure & Import Rules (v2)

> **Canonical implementation map** for BalanceGuard.
>
> This document is the source of truth for:
> - where BalanceGuard code lives
> - what each file is responsible for
> - allowed imports (dependency direction)
> - how **surface-aware** security (Option A) is applied
>
> Read alongside:
> - `balanceguard.md`
> - `balance_kitchen_architecture.md`
> - `balance.md`

---

## 0. Non‑Negotiables

1. **Every HTTP route must be wrapped by BalanceGuard** (no exceptions).
2. BalanceGuard lives in **`src/shared/security/balanceguard/`**.
3. BalanceGuard is **transport-only security** (no domain logic).
4. **Surface-aware CORS is mandatory** (Option A): `site | client | admin`.
5. **No server code imports frontend code.**
6. **No shared security code imports modules/** (shared must be dependency-free from domain).

---

## 1. Canonical File Layout

```text
src/shared/security/balanceguard/
  balanceguard.ts
  types.ts
  errors.ts
  identity.ts
  authz.ts
  ip.ts
  origin.ts
  csrf.ts
  rate-limit.ts
  sessions.ts
  session-cookie.ts
  session-cookie-config.ts
  multipart.ts
```

> Files may grow, but this **boundary** and **responsibility split** must not change.

---

## 2. Responsibilities (Per File)

### 2.1 `balanceguard.ts`

**Role:** The wrapper/orchestrator.

Must:
- construct `RequestContext` (request_id, logger, startedAt, ip, path, method)
- apply **CORS** (surface-aware) + handle preflight
- enforce **Origin** rules (when enabled)
- resolve **Actor** from session cookie → session store
- enforce **auth + RBAC** per route
- enforce **CSRF** (when enabled)
- enforce **rate limiting**
- apply **security headers**
- normalize errors into the canonical shape

Must not:
- parse request bodies (routes do that)
- talk to domain modules

### 2.2 `types.ts`

**Role:** Shared types and contracts used by routes + BalanceGuard.

Must contain:
- `BalanceGuardOptions`
- `RequestContext`
- `Actor` / `Role`
- `CorsOptions` + `CorsMode`

#### `CorsMode` (Option A — canonical)

```ts
export type CorsMode = "none" | "site" | "client" | "admin" | "dashboard";
```

> `dashboard` may be used as a shared mode if you later unify client/admin policy, but **routes should prefer explicit** `client` and `admin`.

### 2.3 `errors.ts`

**Role:** Security error factory + helpers.

Must:
- define the canonical security error codes (e.g. `AUTH_REQUIRED`, `FORBIDDEN`, `ORIGIN_INVALID`, `CSRF_INVALID`, `RATE_LIMITED`)
- provide helpers like `securityError(code, message, status)`

Must not:
- contain transport response formatting (that is centralized)

### 2.4 `identity.ts`

**Role:** Actor resolution.

Must:
- read cookie token via `session-cookie.ts`
- validate session via `sessions.ts`
- derive actor type + role (or `anonymous`)

Must not:
- apply authorization (that is `authz.ts`)

### 2.5 `authz.ts`

**Role:** Authorization rules.

Must:
- enforce route-level `auth.required`
- enforce `roles` allowlist

### 2.6 `ip.ts`

**Role:** IP extraction + trusted proxy behavior.

Must:
- normalize IPv4/IPv6-mapped forms
- only trust proxy headers when configured

### 2.7 `origin.ts`

**Role:** Origin enforcement.

Must:
- validate `Origin` against allowlist rules (per environment)
- support `origin.required` behavior

Important nuance:
- **Do not require Origin** for static GET navigation/assets.
- Origin should be required for browser-based sensitive endpoints and state changes.

### 2.8 `csrf.ts`

**Role:** CSRF enforcement.

Must:
- implement the chosen CSRF strategy (default: double-submit cookie)
- validate CSRF token for unsafe methods when enabled

Surface rules (canonical):
- **site** public enquiry endpoints do not require CSRF
- **client/admin** unsafe session-bearing routes require CSRF once enabled end-to-end

### 2.9 `rate-limit.ts`

**Role:** Rate limiting.

Must:
- enforce per-route limits
- provide canonical key helpers
- emit security logging events for limit hits

### 2.10 `sessions.ts`

**Role:** Session store operations.

Must:
- create session (login)
- fetch/validate session (per request)
- revoke session (logout)

Must not:
- set cookies directly (that is `session-cookie.ts`)

### 2.11 `session-cookie.ts`

**Role:** Cookie read/write helpers.

Must:
- read cookie token from request
- set cookie token on response
- clear cookie token on response

### 2.12 `multipart.ts`

**Role:** Safe multipart/form-data parsing helpers for routes.

Must:
- parse multipart bodies with explicit limits
- enforce max total upload size and per-file size
- expose metadata only (filename, detected mime, size)
- allow routes to stream/store files without loading unbounded buffers

Must not:
- write to disk/object storage directly
- import from `src/modules/**` or `src/server/**`


#### Cookie attributes (Option A)

- Always: `HttpOnly`, explicit `Path`, explicit expiration
- Production cross-origin: `SameSite=None; Secure`

> Rule: if cookies are expected across origins, you must use `SameSite=None; Secure`.

---

## 3. Import Rules (Dependency Direction)

### 3.1 Allowed Imports

- `src/shared/security/balanceguard/**` may import:
  - `src/shared/http/**` (headers, cors helpers, responses)
  - `src/shared/errors/**` (normalize/shape)
  - `src/shared/logging/**` (request context logger)
  - `src/shared/config/env.ts`
  - `src/shared/utils/**`
  - `src/shared/validation/**` (only for low-level helpers; route handlers should parse bodies)

### 3.2 Prohibited Imports

- BalanceGuard must **never** import from:
  - `src/modules/**`
  - `src/server/**`
  - `src/frontend/**`

This keeps BalanceGuard:
- testable
- reusable
- independent from business logic

---

## 4. Route Contract (How Routes Use BalanceGuard)

Every route group must:

1. Define a `BalanceGuardOptions` object per route
2. Wrap the handler with `balanceguard(options, handler)`
3. Keep the handler thin (parse → validate → use-case → response)

### 4.1 Surface-aware CORS (Option A)

Routes must declare:

- marketing/site public routes:
  - `cors: { mode: "site" }`
- client auth + client APIs:
  - `cors: { mode: "client" }`
- admin auth + admin APIs:
  - `cors: { mode: "admin" }`

Avoid ambiguous defaults.

---

## 5. Testing Guidance

Tests must cover:

- CORS mode application (`site/client/admin`) and credentials rules
- Origin enforcement (accept/reject)
- Session cookie parsing + actor resolution
- RBAC enforcement
- Rate limiting behavior
- Error shape normalization

Tests live under:

```text
tests/shared/security/balanceguard/**
```

---

## 6. Definition of Done

A BalanceGuard change is complete only when:

- responsibilities remain split per this file map
- import rules remain clean
- surface-aware CORS behavior is preserved
- cookie attributes match Option A policy
- tests cover the new behavior

---

## 7. Summary

This document locks the BalanceGuard implementation structure so security remains:

- consistent
- auditable
- refactor-safe
- surface-aware under Option A

All contributors must follow this document exactly.

