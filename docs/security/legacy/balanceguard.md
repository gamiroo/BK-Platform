# balanceguard.md — Security, Compliance & Observability Contract (v2)

## Quick Reference

✅ Every HTTP route must be wrapped in `balanceguard(...)`

🔒 Session cookies are opaque, server-side, HttpOnly, and rotated on login/escalation

🚫 No business logic in transport layer

🛡️ AuthZ is deny-by-default, role-based

📊 Logs must include `request_id`, be structured, and redacted

🧱 CORS and Origin are surface-aware (`site`, `client`, `admin`)

⏱️ Rate limits are mandatory for all routes

🧾 CSRF is required for unsafe methods on authenticated routes

🚨 Errors are normalized, safe, and include `request_id`


> **Canonical security specification** for Balance Kitchen (BK).
>
> Balance Kitchen is **framework-free**:
> - Native Node.js `http` for HTTP
> - Native WebSockets for realtime
>
> **BalanceGuard** is the mandatory security wrapper for **all HTTP routes**. Its principles extend directly to WebSockets via **WSGuard**.

This document must be read alongside:

- `balance.md`
- `balance_kitchen_architecture.md`
- `balanceguard_structure.md`
- `balance_kitchen_toolkit.md`
- `balance_kitchen_schema.md`

---

## 0. Status & Scope

**Status:** Approved (v2)

This version reflects the **implemented BalanceGuard flow**, including:

- Request context construction
- Actor resolution via session cookies
- Explicit error semantics (`AUTH_REQUIRED`, `FORBIDDEN`, etc.)
- Framework-free HTTP routing
- WebSocket parity via WSGuard

---

## 1. Non-Negotiables (Absolute)

1. **Every HTTP route must be BalanceGuard-wrapped.**
2. **All WebSocket connections must authenticate and authorize** (handshake + per-event).
3. **Deny by default** — access must be explicitly granted.
4. **No business logic in transports** (HTTP routes or WS handlers).
5. **Never leak internals** — no stack traces in production responses.
6. **Never log secrets or raw PII** — redact aggressively.
7. **Surface-aware security is mandatory**:
   - `site` is public and anonymous (no sessions, no actors)
   - `client` and `admin` are authenticated and session-bearing
   - CORS, cookies, Origin, CSRF, and RBAC are enforced per surface

---

## 2. Threat Model

BalanceGuard mitigates threats categorized under STRIDE:

- **Spoofing** – Session hijacking, forged CSRF tokens
- **Tampering** – Invalid JSON, CSRF, origin bypass
- **Repudiation** – Missing logs, request IDs
- **Information Disclosure** – Stack traces, PII in logs
- **Denial of Service** – Rate limit evasion, WebSocket spam
- **Elevation of Privilege** – Role escalation, missing authz

BalanceGuard also addresses DREAD-rated threats:

- **Damage potential**
- **Reproducibility**
- **Exploitability**
- **Affected users**
- **Discoverability**

Additional chat-specific threats addressed:

- **Anonymous chat abuse (spam, flooding)**
- **File upload attacks (malware, oversized payloads)**
- **Privilege escalation via room membership**
- **Message injection via malformed payloads**



---

## 3. Canonical Authentication Model

### Cookie Attributes (Canonical)

Balance Kitchen uses **surface-isolated session cookies**.

Each authenticated surface has its own cookie:

| Surface | Development (HTTP)     | Production (HTTPS)            |
|-------|------------------------|-------------------------------|
| client| `bk_client_session`    | `__Host-bk_client_session`    |
| admin | `bk_admin_session`     | `__Host-bk_admin_session`     |

Rules:

- Cookies are **opaque** (session token only)
- Cookies are **HttpOnly**
- Cookies are **surface-specific** (never shared)
- Admin cookies are never accepted on client routes (and vice versa)

#### Production (cross-origin)

- `Secure: true`
- `SameSite=None`
- Required for cross-origin dashboards → API

#### Local development (HTTP)

- `Secure: false`
- `SameSite=Lax`
- `__Host-` prefix is NOT used (browser restriction)

> BalanceGuard selects the cookie **by surface**, not by route path.



### 3.2 Session Security Requirements

- Rotate session on:
  - Login
  - Password change
  - Role escalation
  - IP change (optional, high-security mode)
- Invalidate session on:
  - Logout
  - Password reset
  - Account deactivation
- Enforce:
  - Idle timeout (e.g., 30 min)
  - Absolute lifetime (e.g., 12 hours)

### 3.3 Multi-Device Session Model

Balance Kitchen supports **concurrent sessions per user**.

Properties:

- A user may have multiple active sessions
- Each login creates a new session row
- Sessions are scoped by:
  - `user_id`
  - `surface` (`client` | `admin`)
- Logout revokes **only the current session**

This allows:
- Laptop + mobile simultaneously
- Admin + client sessions in parallel
- Safe isolation between devices and roles

Global logout is **not** implicit and must be implemented explicitly if required.

---

## 4. Actor & Identity Resolution

Every request resolves an **Actor**.

### 4.1 Actor Types

- `anonymous`
- `client`
- `admin`
- `account_manager`
- `super_admin`
- `system`

### 4.2 Actor Resolution Flow (Surface-Aware)

1. Determine surface (`client` or `admin`)
2. Read the surface-specific session cookie
3. Validate session (token + surface)
4. Load user identity
5. Enforce:
   - session validity
   - surface match
   - user status === active
6. Derive actor (`client` | `admin`)
7. Attach actor to RequestContext

If any step fails:
- Actor resolves to `anonymous` (fail closed)


---

## 5. Authorization (RBAC)

### 5.1 Route-Level Authorization

Routes declare:

- `auth.required: boolean`
- `auth.roles?: Role[]`

**Rules:**

- Auth required + no session → `AUTH_REQUIRED` (401)
- Auth present + role mismatch → `FORBIDDEN` (403)

### 5.2 Defense in Depth

Use-cases must still validate authorization internally.

BalanceGuard protects the **edge**, not the domain.

---

## 6. Request Context & Correlation

A `RequestContext` is built at the start of every request.

### 6.1 Required Fields

- `requestId` (UUID)
- `startedAt`
- `ip`
- `path`
- `method`
- `actor`
- request-scoped logger

### 6.2 Logging Rules

- All logs include `request_id`
- Actor resolution emits a structured log event

---

## 7. IP Extraction & Trusted Proxies

### 7.1 Rules

- Prefer socket remote address
- Trust proxy headers only when remote IP is trusted
- Normalize IPv4 / IPv6-mapped addresses

### 7.2 Configuration

- Trusted proxies configured per environment
- If unconfigured, proxy headers are ignored

---

## 8. Rate Limiting

Rate limiting is mandatory for:

- Public routes
- Authenticated routes
- Admin routes
- Webhooks
- WebSocket events

### 8.1 Canonical Rate Limit Keys

- Public: `ip:<ip>:route:<path>`
- Authenticated: `user:<id>:route:<path>`
- Webhooks: `webhook:<provider>:route:<path>`
- WS events: `ws:<actor_id>:event:<event>`
- Public chat: `chat:public:ip:<ip>`
- Authenticated chat: `chat:user:<id>`
- File uploads: `chat:upload:<actor_or_ip>`


### 8.2 Behavior

- Exceeded → `429`
- Emit security log event

---

## 9. Input Validation & Body Limits

### 9.1 Parsing Rules

- Never parse unbounded JSON
- Enforce per-route body size limits
- Reject invalid JSON with `400`

### 9.2 Recommended Defaults

- Enquiry: 32–64 KB
- Auth: 8–16 KB
- Stripe webhooks (raw): ≤256 KB

### 9.3 File Upload Handling (Multipart)

When routes accept file uploads:

### Requirements

- Multipart parsing must be explicit
- Enforce per-route maximum file size
- Validate:
  - MIME type
  - magic bytes
- Reject mismatches
- Strip metadata where applicable
- Never store raw uploads in the database

### Storage Rules

- Files are stored externally (object storage)
- Messages reference files by opaque ID only
- Access via signed, time-limited URLs

### Observability

- Emit audit events for:
  - upload attempt
  - upload rejection
  - upload success

### 9.4 Chat Input Limits (Canonical)

Chat routes must enforce explicit, env-driven limits:

- `CHAT_MAX_MESSAGE_LENGTH` (default 2048 chars)
- `CHAT_MAX_ATTACHMENTS_PER_MESSAGE` (default 5)
- `CHAT_ATTACHMENT_MAX_SIZE_BYTES`

Rules:
- Apply limits in transport (HTTP/WS) and re-check in use-cases (defense-in-depth).
- Message bodies are treated as plain text (no HTML).

### 9.5 Invite Token Security (Chat)

Invite tokens must:

- be cryptographically random (recommended: 32 bytes base64url)
- never be stored in plaintext
- be stored as `SHA-256` hash (e.g., `token_hash`)
- have expiry enforced (recommended max 7 days)
- optionally enforce `max_uses` and track `used_count`
- support revocation (`revoked_at`)


---

## 10. CSRF Protection

CSRF protection is required for **session-bearing** unsafe methods:

- `POST`
- `PUT`
- `PATCH`
- `DELETE`

### 10.1 Default Strategy

- Double-submit cookie

Rules:

- Token tied to session
- Validated before state change

### 10.2 Surface Rules (Canonical)

- **site (public marketing)**
  - No session by default
  - Public enquiry endpoints do **not** require CSRF

- **client / admin (authenticated)**
  - Any unsafe method that changes state **must** require CSRF once the CSRF flow is enabled end-to-end

> Keep `login` exempt (no session yet). Apply CSRF to `logout` and all other session-bearing mutations.

> Login endpoints are exempt (no session yet).
> Logout endpoints MUST require CSRF once CSRF enforcement is enabled.


---

## 11. Origin & CORS Enforcement

### 11.1 Origin Checks

Origin enforcement is applied **intentionally**, based on route risk:

- Enforced for browser-based **state changes** and sensitive endpoints
- Missing or invalid origin → reject

Important nuance:

- Browsers may omit `Origin` on:
  - same-origin top-level navigations
  - many static asset loads

So **Origin is not required for static GET delivery**. BalanceGuard route options must reflect this.

### 11.2 CORS Rules

- No wildcard origins for credentialed requests
- Explicit allowlists per environment
- Minimal allowed methods and headers

### 11.3 CORS Modes (Surface-Aware — Canonical)

| Mode     | Use Case               | Credentials | Origin Policy          |
|----------|------------------------|-------------|------------------------|
| `site`   | Public marketing       | No          | Allowlist (marketing)  |
| `client` | Authenticated client UI| Yes         | Allowlist (client)     |
| `admin`  | Admin dashboard        | Yes         | Allowlist (admin)      |
| `none`   | Internal-only routes   | No          | No CORS                |

Per Option A, BK treats each surface as its own **security boundary**.

`CorsMode` is explicit and must be declared per route:

- `site`
  - Intended for **public marketing** calls
  - Typically **no session**
  - Allowlisted to marketing origins only

- `client`
  - Intended for **client dashboard** calls
  - Session-bearing requests must use `credentials: "include"`
  - Requires explicit CORS allowlist to client origins

- `admin`
  - Intended for **admin dashboard** calls
  - Session + RBAC are expected
  - Requires explicit CORS allowlist to admin origins

Guideline:

- If a route sets/reads cookies or relies on session state, it must use a mode that:
  - allows credentials
  - does **not** allow wildcard origins

## 11.4 Public Chat (Site Surface) Security Rules

Public chat routes:

- Use `site` CORS mode
- Never read or set session cookies
- Resolve actor as `anonymous` only
- Enforce:
  - strict origin allowlist
  - aggressive IP-based rate limiting
  - message size limits
  - content validation

Public chat must never escalate privileges or create authenticated sessions.


---

## 12. Security Headers

BalanceGuard applies headers to **every response**.

Required:

- CSP
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`
- `X-Frame-Options` or CSP `frame-ancestors`
- HSTS (production HTTPS only)
- `Cache-Control: no-store` for sensitive endpoints

---

## 13. Error Normalization

### 13.1 Standard Error Shape

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "request_id": "uuid"
  }
}
```

### 13.2 Production Safety

- No stack traces
- Generic messages for internal errors
- Full details logged internally (redacted)

### 13.3 Canonical Error Codes

| Code              | Status | Meaning                          |
|-------------------|--------|----------------------------------|
| `AUTH_REQUIRED`   | 401    | Missing or invalid session       |
| `FORBIDDEN`       | 403    | Role mismatch                    |
| `CSRF_INVALID`    | 403    | CSRF token missing or invalid    |
| `ORIGIN_INVALID`  | 403    | Origin not in allowlist          |
| `RATE_LIMITED`    | 429    | Too many requests                |
| `INPUT_INVALID`   | 400    | Malformed or invalid input       |
| `INTERNAL_ERROR`  | 500    | Unexpected server error          |


---

## 14. Logging, Auditing & Redaction

### 14.1 Request Logs

- method
- path
- status
- duration
- request_id
- actor
- ip

### 14.2 Security Events

Log explicitly:

- rate limit exceeded
- auth failures
- CSRF failures
- origin violations
- webhook verification failures

#### 14.2.1 Moderation Audit Requirements (Chat)

Moderation actions must log:

- who performed the action (actor id + role)
- what was moderated (message_id / room_id / user_id)
- when it occurred
- why (reason code + optional free-text justification)

Reason codes (recommended):
- `SPAM`
- `HARASSMENT`
- `OFF_TOPIC`
- `INAPPROPRIATE_CONTENT`
- `OTHER`


### 14.3 Redaction Rules (Canonical)

Never log:
- `password`, `token`, `secret`, `key`
- `cookie`, `session_id`, `auth`
- `stripeSignature`, `authorization`
- `rawBody` (especially webhooks)

Chat-specific rules:

- **Never log raw message bodies**
- **Message previews (if logged) must be truncated**
- **File names must be sanitized**
- **File contents must never be logged**


Use regex or structured redaction:
```ts
const redact = (key: string, value: any) => {
  if (sensitiveKeys.includes(key)) return "[REDACTED]";
  return value;
};

### 14.4 Canonical Log Schema

All security logs must follow this schema:

```json
{
  "timestamp": "ISO8601",
  "level": "info|warn|error",
  "event_type": "AUTH_FAILURE|CSRF_FAILURE|RATE_LIMIT_HIT|...",
  "request_id": "uuid",
  "ip": "string",
  "actor_id": "string|anonymous",
  "route": "string",
  "method": "GET|POST|...",
  "user_agent": "string",
  "details": { "key": "value" }
}
```

---

## 15. Stripe Webhooks (Hard Requirements)

- Raw body required
- Signature verification mandatory
- Idempotent processing
- Persist processed `event.id`

---

## 16. WebSocket Guard (WSGuard)

### 16.1 Handshake Lifecycle (Visual)

[WS Handshake] ↓ Origin Allowlist → Session Auth → Actor Derivation ↓ [Per-Event Loop] ↓ Schema Validation → AuthZ → Rate Limit → Backpressure → Use-Case

### 16.2 Per-Event Enforcement

- Schema validation
- Authorization
- Rate limiting
- Backpressure control

---

## 17. Operational Defaults

- Request timeouts
- Header timeouts
- Keep-alive tuning
- Graceful shutdown
- Health checks with minimal data

---

## 18. Surface-aware Identity Resolution

BalanceGuard resolves identity using a surface-specific session cookie.

resolveActorFromSession(req, { surface })

Surface determines:
- Which cookie name is read
- Which session is validated
- Which actor kind is allowed


---

## 19. Definition of Done (Security)

A feature is not complete unless:

- HTTP routes are BalanceGuard-wrapped
- WS events apply WSGuard principles
- Inputs are validated
- Auth + authz enforced
- CSRF applied where required
- Rate limits configured
- Logs are structured and redacted
- Tests cover success and failure paths

---

## 20. Summary

BalanceGuard is the **security backbone** of Balance Kitchen.

It guarantees:

- consistent enforcement
- predictable behavior
- safe observability
- framework independence

---

## 21. Security Review Checklist

Before merging any new route or feature:

- [ ] Is the route wrapped with `balanceguard`?
- [ ] Is `actor` resolved correctly?
- [ ] Are auth and authz enforced?
- [ ] Is CSRF enforced for unsafe methods?
- [ ] Is Origin/CORS set correctly?
- [ ] Is input validated and body limited?
- [ ] Are errors normalized and safe?
- [ ] Are logs structured and redacted?
- [ ] Are rate limits applied?
- [ ] Are cookies set with correct attributes?
- [ ] Are secrets not logged or leaked?

---

## 22. Compliance Test Suite

All routes must be tested for:

- Auth enforcement
- RBAC enforcement
- Surface cookie isolation
- CSRF behavior
- Origin / CORS behavior
- Rate limiting
- Input validation
- Error normalization
- Cookie attributes (set / clear)

Tests are written using **Vitest** with module mocking for:

- session store
- identity resolution
- rate limiter
- origin validator

Surface separation (client vs admin) MUST be explicitly tested.



All code must conform to this document exactly.

