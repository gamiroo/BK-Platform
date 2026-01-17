# balanceguard_compliance_routes.md

> A practical, build-time companion to `balanceguard.md`.
>
> This document defines **BalanceGuard-compliant route templates and checklists** for BK (balance-kitchen), so every HTTP and WebSocket entrypoint is implemented consistently and safely.

Related documents:

- `balance.md`
- `balance_kitchen_architecture.md`
- `balance_kitchen_toolkit.md`
- `balanceguard.md`
- `balanceguard_structure.md`
- `balance_kitchen_schema.md`

---

## 1. Why this file exists

This document prevents “almost compliant” routes.

It provides:

- copy/paste templates for new endpoints
- consistent thin-adapter patterns
- a standard review checklist for PRs and AI output

This file does **not** replace `balanceguard.md`; it operationalizes it.

---

## 2. Compliance Rules (Quick Checklist)

Every **HTTP** route must:

- [ ] Be wrapped by `balanceguard(...)`
- [ ] Build a `request_id` and include it in response metadata
- [ ] Extract IP using trusted proxy rules
- [ ] Apply security headers
- [ ] Apply CORS policy (when applicable)
- [ ] Enforce Origin checks for browser state-changing requests (when applicable)
- [ ] Enforce CSRF for unsafe methods (`POST|PUT|PATCH|DELETE`) when using cookie sessions
- [ ] Enforce authentication and RBAC authorization (deny by default)
- [ ] Validate input (body/query/params) before calling use-cases
- [ ] Call **only** application use-cases (no domain logic in routes)
- [ ] Normalize errors to a standard payload (no stack traces in prod)
- [ ] Emit structured logs (with redaction)

Every **WebSocket** entrypoint must:

- [ ] Enforce Origin allowlist during handshake
- [ ] Authenticate via session cookie
- [ ] Authorize connection scope (role + membership)
- [ ] Validate every incoming event payload
- [ ] Rate limit per-connection and per-event
- [ ] Apply backpressure limits (disconnect slow consumers)
- [ ] Persist chat events via module use-cases (transport is not business logic)

---

## 3. Canonical HTTP Route Template (Thin Adapter)

> Conceptual template — adapt types to your real toolkit.

```ts
// src/server/http/routes/<module>.routes.ts

import { balanceguard } from "@/shared/security/balanceguard/balanceguard";
import { validate } from "@/shared/validation/validate";

router.post(
  "/api/<resource>",
  balanceguard(
    {
      auth: { required: true, roles: ["client"] },
      csrf: { required: true },
      cors: { mode: "dashboard" },
      origin: { required: true },
      rateLimit: {
        key: (ctx) => `client:${ctx.actor.id}:<resource>:create`,
      },
    },
    async (ctx, req) => {
      const body = await req.json();
      const input = validate(<schema>, body);

      // const result = await <useCase>({ ...input, requestId: ctx.requestId, actor: ctx.actor });

      return ctx.json(201, { ok: true, data: /* result */ null, request_id: ctx.requestId });
    }
  )
);
```

### Notes

- Public routes should typically key by IP:
  - `key: (ctx) => `public:${ctx.ip}:enquiry:create``
- Webhook routes key by provider/route:
  - `key: () => `webhook:stripe:<topic>``

---

## 4. Public Route Template (Enquiry)

Use when:

- No session required
- Abuse resistance needed

```ts
router.post(
  "/api/enquiry",
  balanceguard(
    {
      auth: { required: false },
      csrf: { required: false },
      cors: { mode: "public" },
      origin: { required: false },
      rateLimit: { key: (ctx) => `public:${ctx.ip}:enquiry:create` },
    },
    async (ctx, req) => {
      const body = await req.json();
      // validate body
      // enforce captcha token presence/format
      // call submitEnquiry use-case
      return ctx.json(200, { ok: true, request_id: ctx.requestId });
    }
  )
);
```

---

## 5. Admin Route Template

Use when:

- Staff-only access
- Potential bulk actions

```ts
router.patch(
  "/api/admin/<resource>/<id>",
  balanceguard(
    {
      auth: { required: true, roles: ["admin", "super_admin"] },
      csrf: { required: true },
      cors: { mode: "dashboard" },
      origin: { required: true },
      rateLimit: { key: (ctx) => `admin:${ctx.actor.id}:<resource>:update` },
    },
    async (ctx, req) => {
      const body = await req.json();
      // validate params + body
      // call admin use-case
      return ctx.json(200, { ok: true, request_id: ctx.requestId });
    }
  )
);
```

---

## 6. Stripe Webhook Template (Hard Requirements)

Must:

- read raw body
- verify signature
- be idempotent (persist `stripe_event_id`)
- never log raw body

```ts
router.post(
  "/webhooks/stripe/<topic>",
  balanceguard(
    {
      auth: { required: false },
      csrf: { required: false },
      cors: { mode: "webhook" },
      origin: { required: false },
      rateLimit: { key: () => `webhook:stripe:<topic>` },
    },
    async (ctx, req) => {
      const raw = await req.text();
      const signature = req.headers.get("stripe-signature") ?? "";

      // verify signature + parse event
      // persist event.id; no-op duplicates
      // route to module handler

      return ctx.json(200, { ok: true, request_id: ctx.requestId });
    }
  )
);
```

---

## 7. WebSocket Compliance Template (Handshake + Event Loop)

```ts
// src/server/websocket/ws-server.ts

import { enforceWsOrigin } from "@/shared/security/wsguard/ws-origin";
import { authenticateWs } from "@/shared/security/wsguard/ws-auth";
import { enforceWsRateLimit } from "@/shared/security/wsguard/ws-rate-limit";
import { validateWsEvent } from "@/shared/security/wsguard/ws-validate";
import { authorizeWsEvent } from "@/shared/security/wsguard/ws-authz";
import { applyWsBackpressure } from "@/shared/security/wsguard/ws-backpressure";

wss.on("connection", async (socket, req) => {
  enforceWsOrigin(req);
  const actor = await authenticateWs(req);

  applyWsBackpressure(socket, { maxQueueSize: 100 });

  socket.on("message", async (raw) => {
    const evt = validateWsEvent(raw);
    enforceWsRateLimit({ actor, eventType: evt.type });
    authorizeWsEvent({ actor, event: evt });

    // Call module use-case (transport only)
    // await handleWsEventUseCase({ actor, requestId, ...evt.payload })
  });
});
```

---

## 8. Rate Limit Key Patterns

### Public

- `public:<ip>:<route>`

### Client

- `client:<actorId>:<route>`

### Admin

- `admin:<actorId>:<route>`

### Webhooks

- `webhook:<provider>:<topic>`

### WebSocket

- `ws:<actorId>:event:<eventType>`

---

## 9. Response Shape Standards

All success responses should follow:

```json
{ "ok": true, "data": { } , "request_id": "<uuid>" }
```

All error responses should follow:

```json
{
  "ok": false,
  "error": {
    "code": "<CANONICAL_CODE>",
    "message": "<SAFE_MESSAGE>",
    "request_id": "<UUID>"
  }
}
```

---

## 10. Static & SPA Route Compliance

Marketing site static routes (/assets/*, /favicon.ico, SPA fallbacks) must:
  - Be wrapped in BalanceGuard

Use a permissive guard:
  - no Origin requirement
  - generous rate limiting
  - Never bypass BalanceGuard entirely

This ensures security headers, logging, and rate limiting remain consistent across all HTTP surfaces.

## 11. Review Checklist (PR / AI Output)

- [ ] Route uses BalanceGuard wrapper
- [ ] Auth + roles set correctly
- [ ] CSRF enabled for unsafe methods
- [ ] Origin enforcement configured
- [ ] CORS mode set appropriately
- [ ] Rate limit key is stable + correct scope
- [ ] Body size limits respected
- [ ] Validation is present
- [ ] Uses use-cases only
- [ ] Errors normalized
- [ ] Logs structured + redacted
- [ ] Tests cover happy + failure paths

---

## 12. Summary

This document is a developer accelerator.

It ensures every entrypoint is:

- secure
- consistent
- testable
- aligned with BalanceGuard and WSGuard

