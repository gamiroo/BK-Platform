# balanceguard_compliance_routes.md — BalanceGuard-Compliant Route Templates & Checklists (v3)

> **Canonical implementation guide** for HTTP and WebSocket entrypoints under BalanceGuard v3.
>
> This document defines **copy/paste-safe templates**, **mandatory options**, and **review checklists**. It is written so an AI agent or developer can implement routes **without inventing behavior**.
>
> This document MUST be used alongside:
>
> - `balanceguard.md` (v3)
> - `balanceguard_structure.md` (v3)
> - `balance_kitchen_architecture.md`

---

## 0. Purpose & Scope

This document exists to:

- prevent "almost compliant" routes
- standardize BalanceGuard options across surfaces
- ensure step-up auth, CSRF, Origin, and rate limits are applied consistently
- provide deterministic patterns for HTTP and WebSocket entrypoints

If a route does not match one of the templates in this file, **it is not compliant**.

---

## 1. Compliance Rules (Quick Checklist)

Every **HTTP** route MUST:

- [ ] Be wrapped using a **surface wrapper** (mandatory):
  - `balanceguardSite(...)`
  - `balanceguardClient(...)`
  - `balanceguardAdmin(...)`
- [ ] Return responses using the standard JSON envelope helpers:
  - `json(ctx, data)` for success
  - `jsonError(ctx, status, code, message)` for expected errors
- [ ] Ensure `request_id` is included in responses via:
  - response envelope (`request_id`)
  - header (`x-request-id`)
- [ ] Error responses MAY include `error.details` only when:
  - the error is expected (AppError-derived)
  - details are structured + non-sensitive
  - details NEVER include stack traces, cookie values, secrets, or PII
- [ ] `INTERNAL_ERROR` responses MUST NOT include `error.details`
- [ ] Enforce Origin checks when configured (fail-closed in production if allowlist missing)
- [ ] Enforce CSRF for unsafe methods where required by surface policy
- [ ] Enforce Rate Limiting **before** handler execution (surface defaults)
- [ ] Normalize unknown errors at the BalanceGuard boundary and return safe envelopes
- [ ] Apply security headers at the final transport edge (Node server adapter / Vercel handler)

Non-negotiables:

- No business logic inside BalanceGuard or transports.
- Transport adapters may normalize paths and build RequestContext only.

---

## 2. Universal Compliance Checklist (v3)

### 2.1 HTTP Routes — Mandatory (Runtime v3)

Every HTTP route MUST:

- [ ] Be wrapped in a surface wrapper:
  - `balanceguardSite(...)`
  - `balanceguardClient(...)`
  - `balanceguardAdmin(...)`

- [ ] Declare transport enforcement explicitly via BalanceGuard options:
  - `requireOrigin: boolean`
  - `requireCsrf: boolean`
  - `requireAuth: boolean` (optional; defaults apply only when `resolveActor` is present)
  - `resolveActor?: (ctx, req) => Actor` (identity hook)
  - `rateLimit?: { max, windowMs, routeKey?, store? }`

- [ ] Validate input before calling application use-cases
- [ ] Never place business logic in routes
- [ ] Rely on BalanceGuard to normalize unexpected errors
- [ ] Ensure responses use canonical JSON envelopes (`json(...)`, `jsonError(...)`)
- [ ] Ensure errors include `request_id` (body + `x-request-id` header)

### 2.1A Canonical Diagnostics for Surface/Origin Failures

**Wrong surface cookie (client cookie sent to admin, or vice versa):**

- HTTP: `403`
- Code: `WRONG_SURFACE`
- `error.details` allowed:
  - `expected_cookie` (name only)
  - `got_cookie` (name only)

**Origin rejected:**

- HTTP: `403`
- Code: `ORIGIN_REJECTED`
- `error.details` allowed:
  - `surface`
  - `reason` (e.g. `no_allowlist_configured`, `not_allowlisted`, `missing_origin`)

### 2.2 WebSocket Entry Points — Mandatory

Every WebSocket entrypoint MUST:

- [ ] Enforce Origin allowlist at handshake
- [ ] Authenticate using session cookie (opaque id)
- [ ] Enforce connection caps
- [ ] Validate every event envelope
- [ ] Enforce per-event authz + AAL where applicable
- [ ] Apply per-event rate limits with burst protection
- [ ] Apply backpressure and disconnect on sustained abuse

---

## 3. Canonical HTTP Route Template (Authenticated Client — Runtime)

```ts
import type { RequestContext } from "../../../shared/logging/request-context.js";
import type { Router } from "../router.js";
import { balanceguardClient } from "../../../shared/security/balanceguard/wrappers.js";
import { json } from "../../../shared/http/responses.js";

// IMPORTANT:
// - Router is exact-match (no params).
// - BalanceGuard enforces transport guarantees.
// - Handler calls application use-cases only.

export function registerClientRoutes(router: Router): void {
  router.post(
    "/api/client/resource/create",
    balanceguardClient(
      {
        requireOrigin: true,     // ✅ sensitive route
        requireCsrf: true,       // ✅ state-changing + session-bearing
        requireAuth: true,       // ✅ client protected
        rateLimit: { max: 60, windowMs: 60_000 },
      },
      async (ctx: RequestContext, req: Request) => {
        const raw = await req.json().catch(() => null);

        // validate(raw) -> input
        // out = await usecase(input)

        return json(ctx, { ok: true });
      }
    )
  );
}


---

## 4. Step-Up Authentication Template (Forward-Compatible)

BalanceGuard v3 supports step-up at the contract level, but the runtime implementation may be staged.

If a route requires higher assurance:

- Keep `requireAuth: true`
- Enforce AAL in the identity/authz layer (or future BalanceGuard extension)
- Return `STEP_UP_REQUIRED` as a normalized AppError

```ts
throw new AppError({
  code: "STEP_UP_REQUIRED",
  status: 403,
  message: "Additional authentication required",
  details: { required_aal: "AAL2" }, // safe metadata
});
```

---

## 5. Public Route Template (Unauthenticated — Runtime)

```ts
import type { RequestContext } from "../../../shared/logging/request-context.js";
import type { Router } from "../router.js";
import { balanceguardSite } from "../../../shared/security/balanceguard/wrappers.js";
import { json } from "../../../shared/http/responses.js";
import { applyCorsHeaders } from "../../../shared/http/cors.js";

export function registerSiteRoutes(router: Router): void {
  router.post(
    "/api/site/enquiry",
    balanceguardSite(
      {
        requireOrigin: true,     // ✅ enforced (fail-closed in prod if no allowlist)
        requireCsrf: false,      // ✅ no session
        requireAuth: false,      // ✅ public
        rateLimit: { max: 10, windowMs: 60_000 },
      },
      async (ctx: RequestContext, req: Request) => {
        const raw = await req.json().catch(() => null);

        // validate(raw) -> input
        // out = await submitEnquiry(input)

        const res = json(ctx, { ok: true });
        return applyCorsHeaders("site", req, res);
      }
    )
  );
}
```

---

## 6. Admin Route Template (High Privilege — Runtime)

```ts
import type { RequestContext } from "../../../shared/logging/request-context.js";
import type { Router } from "../router.js";
import { balanceguardAdmin } from "../../../shared/security/balanceguard/wrappers.js";
import { json } from "../../../shared/http/responses.js";

export function registerAdminRoutes(router: Router): void {
  router.post(
    "/api/admin/resource/update",
    balanceguardAdmin(
      {
        requireOrigin: true,
        requireCsrf: true,
        requireAuth: true,
        rateLimit: { max: 120, windowMs: 60_000 },
      },
      async (ctx: RequestContext, req: Request) => {
        const raw = await req.json().catch(() => null);

        // validate(raw) -> input
        // await adminUsecase(input)

        return json(ctx, { ok: true });
      }
    )
  );
}
```

---

## 7. Stripe Webhook Template (Runtime)

```ts
router.post(
  "/api/site/webhooks/stripe",
  balanceguardSite(
    {
      requireOrigin: false,  // webhooks are not browser-originated
      requireCsrf: false,
      requireAuth: false,
      rateLimit: { max: 300, windowMs: 60_000 },
    },
    async (ctx, req) => {
      const raw = await req.text();

      // await handleStripeWebhook({ raw, sig: req.headers.get("stripe-signature") ?? "" })

      return json(ctx, { ok: true });
    }
  )
);
```

---

## 8. WebSocket Entry Point Template

```ts
wsguard.onConnection(async (socket, req) => {
  enforceWsOrigin(req);

  const actor = await authenticateWs(req);

  enforceWsConnectionCap({
    actor,
    ip: req.ip
  });

  applyWsBackpressure(socket, { maxQueueSize: 100 });

  socket.on('message', async (raw) => {
    const event = validateWsEvent(raw);

    enforceWsRateLimit({
      actor,
      eventType: event.type,
      burst: true
    });

    await authorizeWsEvent({ actor, event });

    await handleWsEventUseCase({
      actor,
      requestId: event.request_id,
      payload: event.payload
    });
  });
});
```

---

## 9. Response Shape (Canonical Runtime)

### Success

```json
{
  "ok": true,
  "request_id": "uuid",
  "data": { /* optional */ }
}
```

### Error

```json
{
  "ok": false,
  "request_id": "uuid",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "request_id": "uuid",
    "details": { }
  }
}

```

---

## 10. Test Matrix (Minimum)

Each route MUST be tested for:

- unauthenticated access
- role mismatch
- insufficient AAL → `STEP_UP_REQUIRED`
- CSRF missing/invalid
- Origin blocked
- rate limit exceeded (steady + burst)
- resource authorization failure

WebSocket tests MUST include:

- handshake origin failure
- auth failure
- connection cap exceeded
- invalid event envelope
- per-event authz failure
- rate limit exceeded
- backpressure disconnect

---

## 11. Review Checklist (PR / AI Output)

- [ ] Route matches a canonical template
- [ ] BalanceGuard options declared explicitly
- [ ] Step-up auth enforced where required
- [ ] CSRF + Origin configured correctly
- [ ] Rate limits deterministic
- [ ] Rate limit store configured (Redis required in production; fail-closed if missing)
- [ ] Use-cases enforce resource auth
- [ ] Error handling normalized
- [ ] Tests cover failure paths

---

## 12. Final Statement

Any route or WebSocket entrypoint that does not conform to this document is **non-compliant by definition**.

This document is authoritative.
