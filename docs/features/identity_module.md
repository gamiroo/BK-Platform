# identity_module.md — Identity Module (v1)
Referenced by balance.md
> **Canonical module document** for `src/modules/identity/`.
>
> The Identity module owns **authentication primitives** (users, passwords, sessions) and the **public login/logout use-cases**.
>
> It is designed to be **framework-free** and **transport-agnostic**.
>
> Related documents:
>
> - `balance.md`
> - `balance_kitchen_architecture.md`
> - `balanceguard.md`
> - `balance_kitchen_schema.md`
>
---

## 0. Scope

Identity is responsible for:

- **User identity records** (email, name, status, password hash)
- **Authentication** (verifying credentials)
- **Session creation and revocation** (server-side sessions)
- **Producing an Actor** for the rest of the system (`client`, later `admin`, etc.)

Identity is *not* responsible for:

- Marketing enquiries (that’s `enquiry`)
- Account membership / multi-tenant scoping (that’s `accounts`)
- RBAC policy decisions beyond producing a minimal `actor` (that’s BalanceGuard + future authorization layer)
- Frontend routing / UI logic

---

## 1. Module Boundaries

### 1.1 DDD placement

Identity is a **core module**. It defines the vocabulary and invariants for authentication.

Layering:

- `domain/` — types + errors
- `application/` — use-cases (transport-agnostic)
- `infrastructure/` — DB repository implementations (Drizzle)
- `transport/` — optional module-owned bindings (not required yet)

### 1.2 Import rules (non-negotiable)

- `src/modules/identity/**` may import from `src/shared/**`
- `src/shared/**` must **never** import from `src/modules/**`
- `src/server/**` (transport) may import **use-cases** and **repositories**, but must remain thin

---

## 2. Canonical File Structure

```text
src/modules/identity/
  domain/
    identity.ts
    errors.ts
  application/
    login.usecase.ts
    logout.usecase.ts
  infrastructure/
    repository.ts
    (db/...)            # optional later if you split further
```

> If you later introduce additional identity concepts (roles, MFA, password reset), add new files within these same layers.

---

## 3. Domain

### 3.1 Domain types

`src/modules/identity/domain/identity.ts`

Identity keeps types small and explicit.

**IdentityUserStatus**

- `active` — permitted to authenticate
- `inactive` — not permitted (business decision)
- `invited` — not permitted until invite completed
- `disabled` — explicitly blocked

**IdentityUser**

Minimum fields needed to authenticate:

- `id: string`
- `email: string`
- `status: IdentityUserStatus`
- `passwordHash: string | null`

**AuthActor (v1)**

For v1, the system returns a single actor kind:

- `kind: "client"`
- `role: "client"`

> Later you will expand actor kinds/roles (admin, account_manager, etc.)—but the *module remains responsible only for emitting the correct actor shape*, not for doing authorization policy.

### 3.2 Domain errors

Identity must not leak details that help attackers.

`AuthInvalidError`

- Thrown on **any** authentication failure (unknown email, wrong password, wrong status, missing password hash)
- Transport should map it to:
  - HTTP `401`
  - Error code: `AUTH_INVALID`
  - Message: calm + generic (e.g. “Invalid credentials.”)

**Important:**

- Do not throw different error types for “email not found” vs “wrong password”.

---

## 4. Application Layer (Use-cases)

### 4.1 login.usecase.ts

`loginUseCase` is the canonical login workflow.

Input (transport-agnostic):

- `email` (string)
- `password` (string)
- `userAgent` (`string | null`)

Dependencies:

- `identityRepo: IdentityRepository`

Outputs:

- `actor: AuthActor`
- `sessionToken: string` (opaque)

Security posture:

- **Collapse** all failures to `AuthInvalidError`
- Deny by default:
  - must have user
  - must be `active`
  - must have `passwordHash`
  - password must verify
- Session is created server-side and returned as an **opaque token**.

**What the use-case does NOT do:**

- It does not set cookies
- It does not build HTTP responses
- It does not parse JSON

Those are transport concerns.

### 4.2 logout.usecase.ts

`logoutUseCase(token)` revokes a session.

Properties:

- **Idempotent**
- If no token: do nothing
- If token invalid/revoked: session layer should handle gracefully

---

## 5. Infrastructure Layer (Repositories)

### 5.1 IdentityRepository contract

`src/modules/identity/infrastructure/repository.ts`

The repository is the boundary between Identity and persistence.

Current required method:

- `findUserForLoginByEmail(emailLower: string): Promise<IdentityUser | null>`

Notes:

- Repository returns the **domain type** (`IdentityUser`)
- If Drizzle returns broader types (e.g. `status: string`), the repository must **map** and **narrow** them to domain types.

### 5.2 Drizzle implementation

The implementation may use:

- `db` from `src/shared/db/drizzle.ts`
- core tables from `src/shared/db/schema/core.ts`

**Rule:**

- Routes must not call Drizzle directly.
- Routes talk to use-cases + repositories.

---

## 6. Persistence Model (Database)

Identity’s canonical tables are defined in `balance_kitchen_schema.md` and implemented in Drizzle core schema.

### 6.1 identity_users

Purpose: store identity records.

Required columns (v1):

- `id` (uuid, pk)
- `email` (text, unique)
- `password_hash` (text, nullable)
- `status` (text) — `ACTIVE | SUSPENDED | INVITED` in schema doc

**Important mapping note (domain vs DB):**

- DB `status` values may be uppercase (`ACTIVE`) while domain uses lowercase (`active`).
- The repository must perform the mapping to keep the domain consistent.

### 6.2 identity_sessions

Purpose: server-side session store.

Required columns (v1):

- `id` (uuid, pk)
- `user_id` (uuid)
- `session_token_hash` (text)
- `expires_at` (timestamptz)
- optional telemetry columns (`ip_created`, `user_agent_created`, etc.)

**Security:**

- Only store a **hash** of the session token.
- Never store the raw token.

### 6.3 identity_login_attempts (recommended)

Purpose: security auditing and abuse control.

In v1, this can be introduced later without affecting API contracts.

---

## 7. Transport Integration

Identity use-cases are invoked by transport routes, but Identity does not own the HTTP server.

### 7.1 Surface ownership

- Marketing **site** surface is public/anonymous.
- Auth endpoints live under the **client** surface.

Canonical endpoints:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### 7.2 BalanceGuard requirements

All endpoints:

- Must be wrapped with `balanceguard(...)`
- Must declare per-route options:
  - `origin` (required for sensitive routes)
  - `rateLimit` (tight for login)
  - `cors.mode` (surface specific: `client`)
  - `auth` required for logout (and later other client routes)

Transport responsibilities:

- Parse JSON (size limited)
- Validate email format + minimum password length (coarse)
- Call `loginUseCase` / `logoutUseCase`
- Set/clear cookie via `session-cookie.ts`

---

## 8. Security Checklist (v1)

### 8.1 Login

- ✅ Rate limit by `ip + path`
- ✅ Generic error responses (no leaks)
- ✅ Password verification uses shared password helper
- ✅ Session token is opaque
- ✅ Cookie set by transport only

### 8.2 Logout

- ✅ Auth required
- ✅ Idempotent
- ✅ Clears cookie even if token missing

### 8.3 Future hardening (planned)

These are intentionally deferred until the next hardening pass:

- Surface-based CORS allowlists (`client`, `admin`) per environment
- CSRF strategy for authenticated unsafe methods
- Session rotation policies
- Idle timeout enforcement
- Login attempt recording + lockout policies

---

## 9. Testing Guidance

Minimum tests to add early:

### 9.1 Application tests

- `loginUseCase`:
  - unknown email → `AuthInvalidError`
  - inactive user → `AuthInvalidError`
  - missing passwordHash → `AuthInvalidError`
  - wrong password → `AuthInvalidError`
  - success → returns actor + sessionToken

- `logoutUseCase`:
  - null token → resolves
  - token present → calls revokeSession

### 9.2 Transport tests (server)

- `POST /api/auth/login`:
  - invalid input → 400
  - invalid credentials → 401
  - success → 200 + sets cookie

- `POST /api/auth/logout`:
  - anonymous → 401
  - authenticated → 200 + clears cookie

- `GET /api/auth/me`:
  - anonymous → returns anonymous actor
  - authenticated → returns actor

---

## 10. Login Rules

Login is surface-constrained.

The login use-case requires:
- email
- password
- expectedRole ("client" | "admin")

If user.role !== expectedRole → AUTH_INVALID

This check exists inside the domain use-case to ensure
security invariants cannot be bypassed at the transport layer.

---

## 11. Definition of Done (Identity)

Identity work is considered complete when:

- Domain types are stable and minimal
- Use-cases are transport-agnostic
- Routes are thin and BalanceGuard-wrapped
- Sessions are server-side with opaque cookies
- Errors do not leak details
- Tests cover both success and failure paths

