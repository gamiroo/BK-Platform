# balanceguard_structure.md — BalanceGuard Structure & Import Rules (v3)

> **Canonical implementation map** for BalanceGuard v3.
>
> This document is the source of truth for:
>
> - where BalanceGuard and WSGuard code lives
> - what each file is responsible for
> - strict dependency direction (import rules)
> - the exact integration points for sessions, AAL, CSRF, Origin, rate limiting, uploads, and WebSockets
>
> It is written to be **AI-agent executable**: an agent must be able to scaffold the repository and implement the security layer without guessing.

---

## 0. Relationship to Other Canonical Docs

This file complements:

- `balanceguard.md` (v3) — **WHAT** must be enforced
- `balanceguard_compliance_routes.md` (v3) — **HOW** routes must be written
- `balance_kitchen_architecture.md` — DDD boundaries + transport rules
- `balance_kitchen_schema.md` — server-side session and auth persistence

If this document conflicts with any other doc, resolution MUST be made by updating the conflicting doc(s) explicitly.

---

## 1. Non‑Negotiables (v3)

1. **Every HTTP route MUST be wrapped by BalanceGuard**.
2. **Every WebSocket connection/event MUST apply WSGuard**.
3. BalanceGuard lives in `src/shared/security/balanceguard/`.
4. WSGuard lives in `src/shared/security/wsguard/` (sibling directory; not nested).
5. BalanceGuard is **transport-only security** (no business/domain logic).
6. Shared security code MUST NOT import from `src/modules/**`.
7. Server code MUST NOT import from `src/frontend/**`.
8. **Sessions are opaque + server-side** (no JWT-in-cookie). Cookie helpers may read/write *opaque identifiers only*.
9. AAL and step-up are enforced at the edge (BalanceGuard/WSGuard), but *factor ceremonies* (passkeys/TOTP) are handled by **auth use-cases**.
10. CI MUST enforce compliance:
    - a build-time check prevents non-wrapped routes
    - a test suite validates BalanceGuard/WSGuard behavior

---

## 2. Canonical Directory Layout

```text
src/shared/security/
  balanceguard/
    balanceguard.ts
    types.ts
    errors.ts
    context.ts
    identity.ts
    authz.ts
    ip.ts
    origin.ts
    csrf.ts
    rate-limit.ts
    sessions.ts
    session-cookie.ts
    session-cookie-config.ts
    uploads/
      multipart.ts
      file-type.ts
      scan.ts
  wsguard/
    ws-guard.ts
    ws-types.ts
    ws-origin.ts
    ws-auth.ts
    ws-authz.ts
    ws-rate-limit.ts
    ws-connection-cap.ts
    ws-backpressure.ts
    ws-validate.ts

src/shared/http/
  responses.ts
  headers.ts
  cors.ts

src/shared/logging/
  request-context.ts
  security-logger.ts

src/shared/errors/
  normalize-error.ts
  http-error-response.ts

src/shared/config/
  env.ts
```

Notes:

- `balanceguard/` contains HTTP orchestration and shared primitives.
- `wsguard/` contains WebSocket enforcement and mirrors the HTTP pipeline.
- Upload handling is isolated under `balanceguard/uploads/` to keep multipart logic out of route handlers.

---

## 3. Dependency Direction (Import Rules)

### 3.1 Allowed Imports (Security Layer)

`src/shared/security/**` MAY import:

- `src/shared/http/**` (headers, cors, responses)
- `src/shared/logging/**` (request context, security logger)
- `src/shared/errors/**` (error normalization helpers)
- `src/shared/config/env.ts`
- `src/shared/utils/**` (pure utilities only)
- external libraries (crypto, uuid, rate-limit store adapters, file-type detection)

### 3.2 Forbidden Imports

`src/shared/security/**` MUST NOT import from:

- `src/modules/**`
- `src/server/**` (no coupling to server runtime wiring)
- `src/frontend/**`

### 3.3 Rationale

- Security remains a stable cross-cutting layer.
- Domain modules remain testable and independent.
- Server wiring can change without breaking security primitives.

---

## 4. Core Types & Contracts (Canonical)

All foundational types MUST live in `src/shared/security/balanceguard/types.ts`.

### 4.1 Surface

```ts
type Surface = 'site' | 'client' | 'admin';
```

### 4.2 Auth Level (AAL)

```ts
type AuthLevel = 'AAL1' | 'AAL2' | 'AAL3';
```

### 4.3 Actor

```ts
type Actor =
  | { kind: 'anonymous'; surface: Surface }
  | { kind: 'client' | 'admin' | 'account_manager' | 'super_admin'; surface: 'client' | 'admin'; userId: string; roles: string[]; authLevel: AuthLevel; sessionId: string };
```

### 4.4 BalanceGuardOptions

```ts
type BalanceGuardOptions = {
  surface: Surface;
  auth: { required: boolean; roles?: string[]; aal?: AuthLevel };
  cors: { mode: Surface };
  origin: { required: boolean; sensitive?: boolean };
  csrf: { required: boolean };
  rateLimit: {
    key: (ctx: RequestContext) => string;
    limit: { windowMs: number; max: number };
    burst?: { rate: number; capacity: number };
  };
  body?: { maxBytes?: number };
};
```

Notes:

- `origin.sensitive` is used for sensitive GETs returning protected data.
- `body.maxBytes` is enforced before parsing.

---

## 5. BalanceGuard HTTP Pipeline (Order is Canonical)

Implemented in `src/shared/security/balanceguard/balanceguard.ts`.

**Pipeline order MUST be:**

1. Build RequestContext (`context.ts` / shared logging)
2. Apply CORS + handle preflight
3. Enforce Origin (if enabled)
4. Enforce body limits (if configured)
5. Resolve Actor (server-side session) via `identity.ts`
6. Enforce Auth + Roles + AAL via `authz.ts`
7. Enforce CSRF via `csrf.ts`
8. Enforce Rate Limit via `rate-limit.ts`
9. Apply security headers via `shared/http/headers.ts`
10. Call the handler
11. Normalize errors via `errors.ts` + shared normalizers
12. Emit security logs

No step may be skipped.

---

## 6. Responsibilities Per File (HTTP)

### 6.1 `balanceguard.ts`

**Role:** Orchestrator.

MUST:

- enforce canonical pipeline order
- pass `RequestContext` to handler
- ensure all responses include `request_id`

MUST NOT:

- parse JSON bodies
- perform domain logic
- call `src/modules/**`

### 6.2 `context.ts`

**Role:** Construct request-scoped context.

MUST:

- generate `request_id`
- capture `ip`, `userAgent`, `path`, `method`, `surface`
- provide request logger with redaction hooks

### 6.3 `errors.ts`

**Role:** Security error factory.

MUST:

- define canonical security error codes (from `balanceguard.md`)
- map codes to HTTP status
- produce safe messages

MUST NOT:

- include stack traces in output

### 6.4 `identity.ts`

**Role:** Actor resolution.

MUST:

- read session cookie (opaque id) via `session-cookie.ts`
- load session via `sessions.ts`
- enforce expiry, revocation, surface match
- return Actor with roles + authLevel

MUST NOT:

- apply route authorization

### 6.5 `sessions.ts`

**Role:** Session storage adapter (server-side).

MUST expose a minimal interface:

```ts
type SessionRecord = {
  sessionId: string;
  userId: string;
  surface: 'client' | 'admin';
  authLevel: AuthLevel;
  createdAt: number;
  lastSeenAt: number;
  revokedAt?: number;
  expiresAt: number;
  sessionFamilyId: string;
  rotationCounter: number;
};

type SessionsStore = {
  get(sessionId: string): Promise<SessionRecord | null>;
  touch(sessionId: string, now: number): Promise<void>;
  revoke(sessionId: string, reason: string, now: number): Promise<void>;
  revokeAllForUser(userId: string, surface: 'client' | 'admin', reason: string, now: number): Promise<void>;
};
```

Notes:

- The implementation may be DB-backed (canonical) and MAY use a cache.
- Enforcing concurrent session limits belongs to the *auth use-cases* and/or session creation logic, not BalanceGuard.

### 6.6 `session-cookie.ts` + `session-cookie-config.ts`

**Role:** Cookie I/O.

MUST:

- read/write **opaque** session IDs
- set correct attributes per surface + env
- clear cookies on logout

MUST NOT:

- encode identity claims

### 6.7 `authz.ts`

**Role:** Route-level enforcement.

MUST:

- enforce `auth.required`
- enforce `auth.roles` intersection
- enforce minimum `auth.aal` (AAL)

### 6.8 `ip.ts`

**Role:** IP extraction and normalization.

MUST:

- support trusted proxy configuration
- return a normalized IP string

### 6.9 `origin.ts`

**Role:** Origin allowlist enforcement.

MUST:

- enforce Origin for any route with `origin.required = true`
- support sensitive GET policy via `origin.sensitive = true`

### 6.10 `csrf.ts`

**Role:** CSRF enforcement.

MUST:

- enforce CSRF for all state-changing session routes when enabled
- support double-submit cookie strategy

### 6.11 `rate-limit.ts`

**Role:** Rate limiting (steady + burst).

MUST:

- enforce steady limits (`windowMs`, `max`)
- implement optional burst token bucket (`rate`, `capacity`)
- emit structured security events

MUST expose store adapter interface:

```ts
type RateLimitStore = {
  /**
   * Fixed-window increment.
   *
   * Returns the new count for the window and the window reset timestamp (ms).
   */
  incrFixedWindow(
    key: string,
    windowMs: number,
    nowMs: number
  ): Promise<{ count: number; resetAtMs: number }>;

  /**
   * Optional burst limiter (token bucket) for high-risk surfaces/routes.
   * Not required for Day 0, but the interface is reserved here for forward compatibility.
   */
  takeTokens?(
    key: string,
    rate: number,
    capacity: number,
    nowMs: number
  ): Promise<{ allowed: boolean; remaining: number }>;
};
```

### 6.12 Upload Security (`uploads/*`)

#### `uploads/multipart.ts`

- parses multipart bodies with explicit limits
- never writes to DB

#### `uploads/file-type.ts`

- deep file-type detection using magic bytes

#### `uploads/scan.ts`

- malware scanning adapter (pluggable)
- default implementation MAY be `clean` in development

---

## 7. WSGuard (WebSocket Parity)

WSGuard mirrors the HTTP pipeline.

### 7.1 Canonical WS Pipeline

1. Enforce Origin (`ws-origin.ts`)
2. Authenticate handshake (session cookie → session record) (`ws-auth.ts`)
3. Enforce connection caps (`ws-connection-cap.ts`)
4. Apply backpressure controls (`ws-backpressure.ts`)
5. For each event:
   - validate schema (`ws-validate.ts`)
   - enforce per-event authz (`ws-authz.ts`)
   - enforce per-event rate limits + burst (`ws-rate-limit.ts`)
   - delegate to use-case

### 7.2 WS Types

All WS types MUST be in `wsguard/ws-types.ts`.

Minimum:

- `WsActor` (mirrors Actor)
- `WsEventEnvelope` `{ type, request_id, payload }`

### 7.3 Disconnection Semantics

- invalid auth → disconnect immediately
- repeated rate-limit violations → disconnect
- sustained backpressure / queue overflow → disconnect

---

## 8. Compliance Enforcement (CI Contract)

A build-time checker MUST exist (name is canonical):

- `check-balanceguard`

Minimum guarantees:

- all HTTP routes in `src/server/http/routes/**` and `src/app/api/**` (if present) are BalanceGuard-wrapped
- all WebSocket entrypoints use WSGuard

If the project structure differs, the checker MUST be updated and documented.

---

## 9. Testing Contract (Security)

Tests MUST live under:

```text
tests/shared/security/balanceguard/**
tests/shared/security/wsguard/**
```

Minimum required suites:

### BalanceGuard

- unauthenticated access to auth-required route → `AUTH_REQUIRED`
- role mismatch → `FORBIDDEN`
- AAL insufficient → `STEP_UP_REQUIRED`
- CSRF missing/invalid → `CSRF_INVALID`
- Origin blocked → `ORIGIN_NOT_ALLOWED`
- rate limit exceeded → `RATE_LIMITED`

### WSGuard

- handshake origin blocked
- handshake auth failure
- connection cap exceeded
- event schema invalid
- per-event authz failure
- per-event rate limit exceeded
- backpressure disconnect

---

## 10. Definition of Done (Structure)

A security-layer change is complete only when:

- files are placed exactly as defined here
- import rules remain clean
- BalanceGuard and WSGuard pipelines are intact
- session cookies remain opaque
- AAL enforcement is implemented and tested
- CI compliance checks pass

---

## 11. Summary

This document locks the **shape** of BalanceGuard v3 and WSGuard v3.

It prevents architectural drift, enforces clean dependency direction, and ensures the security layer remains stable as features (MFA, passkeys, uploads, realtime) expand.
