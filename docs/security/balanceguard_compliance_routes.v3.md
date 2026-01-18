# balanceguard_compliance_routes.md — BalanceGuard-Compliant Route Templates & Checklists (v3)

> **Canonical implementation guide** for HTTP and WebSocket entrypoints under BalanceGuard v3.
>
> This document defines **copy/paste-safe templates**, **mandatory options**, and **review checklists**. It is written so an AI agent or developer can implement routes **without inventing behavior**.
>
> This document MUST be used alongside:
> - `balanceguard.md` (v3)
> - `balanceguard_structure.md` (v3)
> - `balance_kitchen_architecture.md`

---

## 1. Purpose & Scope

This document exists to:
- prevent "almost compliant" routes
- standardize BalanceGuard options across surfaces
- ensure step-up auth, CSRF, Origin, and rate limits are applied consistently
- provide deterministic patterns for HTTP and WebSocket entrypoints

If a route does not match one of the templates in this file, **it is not compliant**.

---

## 2. Universal Compliance Checklist (v3)

### 2.1 HTTP Routes — Mandatory

Every HTTP route MUST:

- [ ] Be wrapped in `balanceguard(options, handler)`
- [ ] Declare `surface` explicitly (`site` | `client` | `admin`)
- [ ] Declare auth requirements (`auth.required`, `auth.roles`, `auth.aal`)
- [ ] Enforce CSRF for all state-changing, session-bearing routes
- [ ] Enforce Origin for all sensitive routes (including sensitive GETs)
- [ ] Apply rate limiting (steady + optional burst)
- [ ] Enforce request body size limits before parsing
- [ ] Validate and sanitize input
- [ ] Call **only** application use-cases (no domain logic)
- [ ] Normalize errors (no stack traces)
- [ ] Emit structured logs with `request_id`

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

## 3. Canonical HTTP Route Template (Authenticated Client)

```ts
balanceguard(
  {
    surface: 'client',
    auth: {
      required: true,
      roles: ['client'],
      aal: 'AAL1'
    },
    cors: { mode: 'client' },
    origin: { required: true, sensitive: true },
    csrf: { required: true },
    body: { maxBytes: 64 * 1024 },
    rateLimit: {
      key: (ctx) => `client:${ctx.actor.userId}:resource:create`,
      limit: { windowMs: 60_000, max: 600 },
      burst: { rate: 10, capacity: 20 }
    }
  },
  async (ctx, req) => {
    const input = validate(schema, await req.json());

    const result = await createResourceUseCase({
      ...input,
      actor: ctx.actor,
      requestId: ctx.requestId
    });

    return ctx.json(201, {
      ok: true,
      data: result,
      request_id: ctx.requestId
    });
  }
);
```

**Notes:**
- Sensitive GETs (e.g. `/me`, `/account`) MUST set `origin.sensitive = true`
- Resource-level authorization MUST occur inside the use-case

---

## 4. Step-Up Authentication Template (AAL Enforcement)

Used for routes requiring MFA/passkey verification.

```ts
balanceguard(
  {
    surface: 'client',
    auth: {
      required: true,
      roles: ['client'],
      aal: 'AAL2'
    },
    cors: { mode: 'client' },
    origin: { required: true, sensitive: true },
    csrf: { required: true },
    rateLimit: {
      key: (ctx) => `client:${ctx.actor.userId}:security:change`,
      limit: { windowMs: 60_000, max: 30 }
    }
  },
  async (ctx, req) => {
    const input = validate(schema, await req.json());

    const result = await sensitiveActionUseCase({
      ...input,
      actor: ctx.actor,
      requestId: ctx.requestId
    });

    return ctx.json(200, { ok: true, request_id: ctx.requestId });
  }
);
```

If `ctx.actor.authLevel < AAL2`, BalanceGuard responds automatically:

```json
{
  "ok": false,
  "error": {
    "code": "STEP_UP_REQUIRED",
    "message": "Additional authentication required",
    "request_id": "uuid"
  }
}
```

---

## 5. Public Route Template (Unauthenticated)

```ts
balanceguard(
  {
    surface: 'site',
    auth: { required: false },
    cors: { mode: 'site' },
    origin: { required: false },
    csrf: { required: false },
    body: { maxBytes: 32 * 1024 },
    rateLimit: {
      key: (ctx) => `public:${ctx.ip}:enquiry:create`,
      limit: { windowMs: 60_000, max: 20 },
      burst: { rate: 5, capacity: 10 }
    }
  },
  async (ctx, req) => {
    const input = validate(schema, await req.json());

    await submitEnquiryUseCase({
      ...input,
      requestId: ctx.requestId
    });

    return ctx.json(200, { ok: true, request_id: ctx.requestId });
  }
);
```

---

## 6. Admin Route Template (High Privilege)

```ts
balanceguard(
  {
    surface: 'admin',
    auth: {
      required: true,
      roles: ['admin', 'super_admin'],
      aal: 'AAL2'
    },
    cors: { mode: 'admin' },
    origin: { required: true, sensitive: true },
    csrf: { required: true },
    rateLimit: {
      key: (ctx) => `admin:${ctx.actor.userId}:resource:update`,
      limit: { windowMs: 60_000, max: 120 }
    }
  },
  async (ctx, req) => {
    const input = validate(schema, await req.json());

    await adminUpdateUseCase({
      ...input,
      actor: ctx.actor,
      requestId: ctx.requestId
    });

    return ctx.json(200, { ok: true, request_id: ctx.requestId });
  }
);
```

---

## 7. Stripe Webhook Template

```ts
balanceguard(
  {
    surface: 'site',
    auth: { required: false },
    cors: { mode: 'none' },
    origin: { required: false },
    csrf: { required: false },
    body: { maxBytes: 512 * 1024 },
    rateLimit: {
      key: () => 'webhook:stripe',
      limit: { windowMs: 60_000, max: 300 }
    }
  },
  async (ctx, req) => {
    const raw = await req.text();

    await handleStripeWebhookUseCase({
      rawPayload: raw,
      signature: req.headers.get('stripe-signature') ?? '',
      requestId: ctx.requestId
    });

    return ctx.json(200, { ok: true, request_id: ctx.requestId });
  }
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

## 9. Response Shape (Canonical)

### Success

```json
{
  "ok": true,
  "data": { /* optional */ },
  "request_id": "uuid"
}
```

### Error

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
- [ ] Use-cases enforce resource auth
- [ ] Error handling normalized
- [ ] Tests cover failure paths

---

## 12. Final Statement

Any route or WebSocket entrypoint that does not conform to this document is **non-compliant by definition**.

This document is authoritative.

