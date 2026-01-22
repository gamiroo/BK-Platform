# balanceguard.md — Security, Compliance & Observability Contract (v3)

> **Canonical security constitution** for Balance Kitchen (BK).
>
> This document is the single source of truth governing **all HTTP and WebSocket entrypoints**. It defines *what must be enforced*, *how it must behave*, and *what invariants must never be violated*.
>
> This document is written to be **AI-agent executable**: an agent must be able to build the system without guessing.

---

## Quick Reference (Non‑Negotiable)

✅ Every HTTP route MUST be wrapped in `balanceguard(...)`

🔒 Session cookies are **opaque**, server‑side, HttpOnly, surface‑isolated

🔐 Authentication is **AAL‑aware** (supports MFA + passkeys + step‑up)

🚫 No business logic in transport layers

🛡️ AuthZ is deny‑by‑default, role‑based, **and resource‑aware**

📊 Logs are structured, redacted, and include `request_id`

🧱 CORS + Origin enforcement is **surface‑aware**

⏱️ Rate limiting is mandatory for HTTP (steady fixed-window); burst/token-bucket is reserved for future implementation

🧾 CSRF is required for **all state‑changing session routes (including logout)**

🚨 Errors are normalized and safe (no stack traces in responses, any env)

---

## 0. Status & Scope

**Status:** Approved (v3)

BalanceGuard v3 governs:

- HTTP APIs (public, client, admin)
- WebSocket connections and events (via WSGuard)
- Authentication, authorization, and step‑up enforcement
- Rate limiting, abuse protection, and observability

This document MUST be read alongside:

- `balance.md`
- `balance_kitchen_architecture.md`
- `balanceguard_structure.md`
- `balanceguard_compliance_routes.md`
- `balance_kitchen_schema.md`

---

### 0.1 CI Enforcement (Mandatory)

BalanceGuard compliance is enforced in CI/CD (see `devops_setup.md`).

CI must fail if:

- any HTTP route is added/modified without a BalanceGuard wrapper
- required security headers are not applied
- rate limiting / origin / CSRF enforcement is missing where required

This prevents security regressions from reaching trunk or production.

Additional CI/runtime guardrail (Vercel API deployments):

- Vercel Serverless Function entrypoints MUST export a Web Handler:
  - `export default { async fetch(request) { return Response } }`

Rationale:

- Incorrect handler shapes can cause requests to never finalize (timeouts / 504).
- This is a production availability risk and is treated as a compliance failure.

This guardrail is part of BalanceGuard’s “fail closed” principle:
availability failures must be surfaced immediately and deterministically.

---

### 0.2 Runtime Enforcement Status

BalanceGuard is **fully enforced at runtime and in CI**.

Current guarantees:

- All HTTP routes across `site`, `client`, and `admin` are BalanceGuard-wrapped
- CI fails if any route is added or modified without a BalanceGuard wrapper
- Error normalization, security headers, CSRF, origin enforcement, and rate limiting
  are covered by automated unit tests
- BalanceGuard behavior is validated independently of transport or framework concerns

BalanceGuard is not advisory.

Any code path that bypasses BalanceGuard is considered **invalid by definition**.

## 1. Threat Model

BalanceGuard explicitly mitigates:

- Session hijacking
- CSRF
- Horizontal & vertical privilege escalation
- Abuse / DoS (HTTP & WebSocket)
- Sensitive data leakage via logs or errors
- Replay & race conditions
- Upload‑based attacks

Defense is **layered**: no single control is sufficient alone.

---

## 2. Core Principles (Absolute)

1. **Deny by default** — access must be explicitly granted
2. **Transport ≠ domain** — routes never contain business logic
3. **Fail closed** — ambiguous auth resolves to `anonymous`
4. **Least privilege** — roles + AAL must both be satisfied
5. **Defense in depth** — edge + domain authorization
6. **Observability without leakage** — logs yes, secrets never

Violation of these principles is a **build failure**.

---

## 3. Canonical Session Model (Option A)

### 3.1 Opaque Sessions (Mandatory)

- Session cookies contain **opaque identifiers only**
- No JWTs or identity claims in cookies
- All identity state lives server‑side

### 3.2 Session Cookies (Surface‑Isolated)

| Surface | Dev (HTTP) | Prod (HTTPS) |
| ------- | ------------ | -------------- |
| client | `bk_client_session` | `__Host-bk_client_session` |
| admin | `bk_admin_session` | `__Host-bk_admin_session` |

Cookie attributes:

- `HttpOnly: true`
- `Secure: true` (prod)
- `SameSite=None` (when cross‑origin)
- `__Host-` prefix in production

---

## 4. Session Record (Server‑Side Contract)

A session record MUST contain:

- `session_id`
- `user_id`
- `surface` (`client` | `admin`)
- `created_at`, `last_seen_at`
- `auth_level` (`AAL1` | `AAL2` | `AAL3`)
- `session_family_id`
- `rotation_counter`
- `revoked_at`, `revoke_reason`
- device context (soft‑binding only):
  - `user_agent_snapshot`
  - `device_id_hash?`
  - `ip_created` (audit only)

### 4.1 Session Invariants

- Sessions are **revocable immediately**
- Session state is authoritative server‑side
- IP changes MUST NOT hard‑invalidate a session

---

## 5. Session Lifecycle (State Machine)

### States

```flow
ACTIVE → ROTATED → REVOKED → EXPIRED
```

### Transitions

| Trigger | Effect |
| ------ | ------- |
| Login | Create new session |
| Rotation event | New session, old marked replaced |
| Logout | Revoke session |
| Password reset | Revoke all sessions |
| Idle timeout | Expire session |
| Absolute lifetime | Expire session |

Concurrent session limit:

- Default: **5 per user per surface**
- Oldest active session is revoked first

---

## 6. Authentication Assurance Levels (AAL)

### 6.1 Canonical Levels

| Level | Meaning |
| ---- | -------- |
| AAL1 | Password / magic‑link |
| AAL2 | MFA verified (TOTP or WebAuthn UV) |
| AAL3 | Strong passkey / hardware‑backed |

### 6.2 AAL Transitions

- Login → `AAL1`
- MFA verify → `AAL2`
- Passkey verify → `AAL2` or `AAL3` (policy)

### 6.3 Downgrade Rules

- Idle timeout MAY downgrade AAL
- New session ALWAYS starts at `AAL1`

---

## 7. Step‑Up Authentication

Routes MAY declare required AAL:

```ts
auth: { required: true, roles: ['admin'], aal: 'AAL2' }
```

If actor AAL < required AAL:

- Respond `STEP_UP_REQUIRED`
- Do NOT revoke session
- Preserve request_id

---

## 8. Actor Resolution

Every request resolves an Actor:

- `anonymous`
- `client`
- `admin`
- `account_manager`
- `super_admin`
- `system`

Resolution flow:

1. Determine surface
2. Read session cookie
3. Load session
4. Validate (not revoked, not expired, surface match)
5. Load user + roles
6. Attach actor + AAL to RequestContext

Failure at any step → `anonymous`.

---

## 9. Authorization

### 9.1 Route‑Level (BalanceGuard)

Routes declare:

- `auth.required`
- `auth.roles`
- `auth.aal`

### 9.2 Resource‑Level (Mandatory)

Use‑cases MUST verify ownership / scope.

BalanceGuard NEVER authorizes specific resources.

---

## 10. CSRF Protection

- Required for **all state‑changing, session‑bearing routes**
- Includes logout, email change, MFA actions
- Excludes public unauthenticated endpoints

Strategy: double‑submit cookie (canonical).

---

## 11. Origin & CORS Enforcement

- Surface‑aware allowlists
- Origin checks required for **any endpoint returning sensitive data**, regardless of method

---

## 12. Rate Limiting (Canonical Defaults)

### 12.1 Contract

BalanceGuard rate limiting is:

- deterministic and testable (store injected)
- keyed by: `surface + ip + routeKey`
- fixed-window: allow up to `max` requests per `windowMs`

When a request exceeds the limit:

- HTTP responds `429`
- error code: `RATE_LIMITED`
- details include:
  - `surface`
  - `routeKey`
  - `reset_at_ms`
  - `limit`

### 12.2 Storage Strategy

BalanceGuard uses a pluggable store:

- `test` / `development`: in-memory store allowed when `REDIS_URL` is not set
- `production` (or `VERCEL_ENV=production`): Redis is required (fail-closed if missing)

Redis configuration:

- env var: `REDIS_URL`
- store uses atomic increment + expiry to implement fixed-window counters

### 12.3 Default Bucket Key

Default key format is stable and low-cardinality:

- `bg:rl:<surface>:<ip>:<routeKey>`

Default `routeKey` is:

- `METHOD:pathname` (query string excluded)

---

## 13. Errors (Canonical Contract)

### 13.1 Error Shape

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human‑readable message",
    "request_id": "uuid"
  }
}
```

### 13.2 Canonical Error Codes

| Code | HTTP | Meaning |
| ---- | ------ | -------- |
| AUTH_REQUIRED | 401 | No valid session |
| FORBIDDEN | 403 | Role not permitted |
| STEP_UP_REQUIRED | 403 | AAL insufficient |
| CSRF_INVALID | 403 | CSRF failed |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Internal failure |

---

## 14. Logging & Redaction

- All logs include `request_id`
- Never log secrets or raw PII
- Chat bodies are never logged
- File uploads log generated IDs only

CI must include route-level tests that assert:

- responses include `request_id` correlation where applicable
- errors are normalized and safe
- required security headers are present

---

## 15. WebSockets (WSGuard Parity)

WebSockets MUST enforce:

- Origin allowlist
- Session authentication
- Role + resource authorization per event
- Rate limits (steady; burst/token-bucket reserved for future implementation)
- Backpressure thresholds

---

## 16. Testing Requirements

Tests MUST cover:

- Auth success & failure
- AAL enforcement
- Step‑up flows
- CSRF failures
- Rate limits (steady fixed-window; burst/token-bucket reserved for future implementation)
- Session revocation
- WebSocket abuse paths

---

## 17. Definition of Done (Security)

A feature is complete only when:

- BalanceGuard / WSGuard applied
- Auth + AuthZ + AAL enforced
- CSRF & Origin rules satisfied
- Rate limits enforced
- Logs are structured and redacted
- Tests cover success + failure paths

---

## 18. Final Statement

BalanceGuard v3 defines the **security boundary of Balance Kitchen**.

Any code that bypasses this contract is considered **invalid by definition**.

This document is authoritative.
