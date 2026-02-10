# BalanceGuard Auth, CSRF, and Surface Isolation

> **Status:** Implemented (admin + client)
>
> **Scope:** Authentication boot flow, CSRF enforcement, cookie isolation, and frontend routing gates.
>
> This document records the final, working design for BalanceGuard’s multi-surface auth model and is the canonical reference for future feature work.

---

## 1. Problem This Solves

Balance Kitchen runs **multiple surfaces** (admin, client, site) that:

- Share infrastructure
- May run on different subdomains in production
- Must never trust or leak auth state across surfaces

This document formalizes how we now guarantee:

- Surface-isolated session cookies
- Surface-aware CSRF enforcement
- Deterministic frontend boot & routing
- No duplicate or ghost cookies
- Testable, invariant-preserving behavior

---

## 2. Canonical Invariants

These rules are **non‑negotiable**:

### 2.1 Session Cookies

- Exactly **one HttpOnly session cookie per surface**
- Never shared across surfaces
- Never written client-side

| Surface | Cookie name (dev) | HttpOnly | Scope |
|-------|------------------|---------|-------|
| Admin | `bk_admin_session` | ✅ | surface domain |
| Client | `bk_client_session` | ✅ | surface domain |

Session cookies:
- Are opaque IDs only
- Contain no identity data
- Are set and cleared **only** by the server

---

### 2.2 CSRF Cookies

- Exactly **one CSRF cookie per surface**
- **Not HttpOnly** (frontend must read it)
- No legacy/global CSRF cookies

| Surface | Cookie name |
|-------|-------------|
| Admin | `bk_csrf_admin` |
| Client | `bk_csrf_client` |

Rules:

- CSRF token is generated server-side
- Sent via `Set-Cookie`
- Frontend reads cookie and echoes via `x-csrf-token`
- Server enforces double-submit match

---

### 2.3 Origin Enforcement

BalanceGuard enforces `Origin` on **all non-site surfaces**.

- Missing or invalid `Origin` ⇒ `ORIGIN_REJECTED`
- Vite dev config **must** allow surface hosts

This prevents:
- CSRF via foreign origins
- Credential leakage across surfaces

---

## 3. Backend: Route Contracts

### 3.1 Login Routes

| Route | CSRF required | Sets session | Sets CSRF |
|------|---------------|-------------|-----------|
| `/api/admin/auth/login` | ❌ | ✅ | ✅ |
| `/api/client/auth/login` | ❌ | ✅ | ✅ |

**Important:**

- Login routes explicitly disable CSRF (`requireCsrf: false`)
- CSRF is established *by* login

---

### 3.2 `/auth/me`

| Condition | Response |
|---------|----------|
| Valid surface session | `200 { actor }` |
| Wrong-surface cookie | `403 WRONG_SURFACE` |
| No session | `401 UNAUTHENTICATED` |

Used for:

- Frontend boot gating
- Refresh persistence
- Security tests

---

### 3.3 Logout Routes

| Route | CSRF | Clears |
|------|------|--------|
| `/api/admin/auth/logout` | ✅ | session + CSRF |
| `/api/client/auth/logout` | ✅ | session + CSRF |

Logout is:

- Idempotent
- Best-effort
- Safe even if session already gone

---

## 4. Frontend: Auth Gate Pattern

Each surface implements a **3-state gate**:

```ts
booting → authed | unauthed
```

Rules:

- Never render dashboard before `/auth/me` resolves
- Never trust cookies without `/auth/me`
- Routing is derived from auth state, not URL intent

### Login Page Rules

- NEVER write cookies with `document.cookie`
- Server is the source of truth
- On success: call `onLoggedIn()` only

### Logout Rules

- Fire `/auth/logout`
- Flip auth state locally
- Route to login regardless of network outcome

---

## 5. Development vs Production

### Localhost (Expected Oddities)

On `localhost`:

- Cookies appear shared across surfaces
- Browser cannot isolate by host

**This is acceptable in dev.**

### Production (Required)

Each surface runs on its own origin:

- `admin.balancekitchen.com.au`
- `client.balancekitchen.com.au`

This guarantees:

- Cookie isolation
- Origin enforcement
- No cross-surface leakage

---

## 6. Test Coverage Guarantees

The following test categories now pass and are required going forward:

- Login sets exactly one session cookie
- CSRF required for logout
- `/auth/me` denies wrong surface
- Logout invalidates session
- Refresh preserves auth

Any future auth changes **must** preserve these tests.

---

## 7. Related Documents

This document is referenced by:

- `balanceguard.md`
- `balance_kitchen_architecture.md`
- `balance_kitchen_tokens.md`

---

## 8. TL;DR (Executive Summary)

- Cookies are surface-isolated
- CSRF is per-surface and strict
- Frontend never writes cookies
- `/auth/me` is the source of truth
- Dev quirks are understood and safe
- Production is secure by construction

🚀 Safe to proceed with feature development.

