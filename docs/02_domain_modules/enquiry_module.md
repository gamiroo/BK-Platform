# enquiry_module.md — Enquiry Module (v1)

Referenced by balance.md
> **Canonical Enquiry module specification** for Balance Kitchen (BK).
>
> This module owns the **public “Request Access” enquiry** workflow end-to-end, from the marketing surface through persistence and downstream processing (notifications/CRM).
>
> **Key goals:**
>
> - Keep the marketing surface anonymous/public.
> - Keep HTTP routes as *thin adapters*.
> - Move business meaning and persistence boundaries into `src/modules/enquiry/**`.
> - Maintain BalanceGuard compliance for all HTTP endpoints.

Related documents:

- `balance.md`
- `balance_kitchen_architecture.md`
- `balanceguard.md`
- `balance_kitchen_schema.md`

---

## 0. Non‑Negotiables

1. **No domain or business logic in HTTP routes** — routes validate, then call a use-case.
2. **All HTTP endpoints are BalanceGuard-wrapped.**
3. **Enquiry is public/anonymous** — no auth and no session required.
4. **Honeypot handling is transport-level** (UI + route), not domain.
5. **Do not leak internal processing** (e.g., whether an email already exists).
6. **PII is treated as sensitive** — redact in logs and avoid storing unnecessary data.

---

## 1. Responsibilities

### 1.1 What the Enquiry module owns

- Domain vocabulary for enquiries (request access)
- Use-case orchestration for submitting enquiries
- Persistence boundary (`EnquiryRepository`)
- (Later) Infrastructure implementation: DB-backed repository + email/CRM enqueue
- (Later) Eventing: enquiry events and activity logs

### 1.2 What the Enquiry module does NOT own

- HTTP parsing, CORS, Origin checks, rate limiting, security headers (BalanceGuard)
- UI rendering and client-side form behavior
- Session/authentication (Identity module)

---

## 2. Folder Structure

```text
src/modules/enquiry/
  domain/
    enquiry.ts
    errors.ts
    status.ts
  application/
    submit-request-access.usecase.ts
    types.ts
  infrastructure/
    repository.ts
    db/
      schema.ts            (later)
      repository.ts        (later)
  transport/
    http/
      routes.ts            (optional, if you move module-owned routes later)
```

> For now, your HTTP route lives under `src/server/http/routes/site.routes.ts` (marketing surface). That is fine and compliant as long as it stays thin.

---

## 3. Domain Model

### 3.1 Types

The domain is intentionally small for v1.

- **RequestAccessEnquiry** — the normalized business concept.
- **EnquiryStatus** — lifecycle state.

Recommended:

- Status enum values are **lowercase** in code and mapped consistently to DB values.
- Domain types must be **transport-agnostic**.

### 3.2 Canonical domain shape (v1)

```ts
export type EnquiryStatus = "new" | "in_progress" | "closed";

export type RequestAccessEnquiry = Readonly<{
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  notes?: string;
  company?: string;
  status: EnquiryStatus;
  createdAt: Date;
}>;
```

#### Optional fields rule (exactOptionalPropertyTypes)

With `exactOptionalPropertyTypes: true`:

- Optional fields must be *omitted* when absent (not set to `undefined`).
- Use conditional spreads when constructing objects:

```ts
const x = {
  ...(maybePhone ? { phone: maybePhone } : {}),
};
```

---

## 4. Application Layer

### 4.1 Use-case: submitRequestAccess

**Purpose:** accept validated input from transport, normalize it, assign identity fields (id, status, createdAt), and persist via the repository boundary.

#### Inputs (transport contract)

```ts
export type SubmitRequestAccessInput = Readonly<{
  full_name: string;
  email: string;
  phone?: string;
  notes?: string;
  company?: string;
}>;
```

#### Behavior

- Normalizes `full_name` and `email` (trim; email lowercased if that’s your canonical policy)
- Generates an `id` (UUID)
- Sets `status = "new"`
- Sets `createdAt = new Date()`
- Calls `repo.createRequestAccess(enquiry)`

#### What validation lives where

- **Route/transport validates**:
  - required fields
  - basic email format
  - max body size (`parseJson` maxBytes)
  - honeypot field behavior

- **Use-case validates minimal invariants**:
  - normalized non-empty strings (defense-in-depth)

> Keep errors calm: the public endpoint should return `{ ok: true }` on success, and safe `400` on validation failure.

---

## 5. Infrastructure Layer

### 5.1 Repository boundary

```ts
export type EnquiryRepository = Readonly<{
  createRequestAccess: (enquiry: RequestAccessEnquiry) => Promise<void>;
}>;
```

### 5.2 No-op repository (dev bootstrap)

A no-op repository is acceptable early, but must be swapped before production.

Use cases:

- UI + security + endpoint wiring can ship while DB work is staged.
- Keeps routes thin and architecture compliant.

### 5.3 DB-backed repository (recommended next)

When ready, implement:

- `src/modules/enquiry/infrastructure/db/schema.ts`
- `src/modules/enquiry/infrastructure/db/repository.ts`

Backing tables per `balance_kitchen_schema.md`:

- `enquiry_enquiries`
- `enquiry_events` (optional for v1)

DB write rules:

- Use `tx.ts` if you need to write multiple tables.
- Store only required PII.

---

## 6. Transport Integration

### 6.1 Current route integration

Your marketing route is correctly structured:

- BalanceGuard wrapper
- parse JSON with a body limit
- honeypot handled in transport
- minimal field validation
- calls `submitRequestAccess({ repo }, input)`

File:

- `src/server/http/routes/site.routes.ts`

### 6.2 Security posture for public enquiry

Required:

- **Origin required** (protects against cross-site form abuse)
- **Rate limiting** per IP + route
- **CORS mode: site** (tight allowlist)

Recommended:

- Add basic spam heuristics later (time-to-submit, repeated payload fingerprint)
- Store an enquiry fingerprint hash (server-side) if you want dedupe without leaking email existence

---

## 7. Logging & Observability

### 7.1 What to log

- A single structured event: `enquiry.request_access.received`
- Include:
  - request_id (automatic via ctx logger)
  - a redacted/hashed email identifier
  - outcome: accepted/rejected

### 7.2 What NOT to log

- raw email, phone, notes
- full payload

> Use `redact.ts` helpers when you wire deeper logs.

---

## 8. Testing

### 8.1 Unit tests (module)

- `submitRequestAccess`:
  - trims
  - sets status
  - generates id
  - omits optionals when absent
  - calls repo once

### 8.2 Integration tests (server)

- POST `/api/enquiry/request-access`:
  - 200 on valid input
  - 400 on missing name/email
  - 200 on honeypot filled (generic ok)
  - 429 on rate limit
  - Origin missing/invalid rejected (per BalanceGuard policy)

---

## 9. Roadmap (Suggested Next Enhancements)

1. **DB-backed repository** for `enquiry_enquiries`
2. **Enquiry events** (append-only) for lifecycle updates
3. Add **notifications module** hook:
   - enqueue email to internal staff
4. Add **CRM integration** (Zoho / etc.) via infrastructure provider adapter
5. Add **admin workflows** to triage enquiries:
   - move from `new` → `in_progress` → `closed`

---

## 10. Definition of Done

The Enquiry module is “done” for production when:

- Enquiry data is persisted (DB-backed repo)
- Public endpoint is BalanceGuard-wrapped with strict Origin + rate limiting
- Logs are structured and redacted
- Tests cover success/failure/honeypot/rate limit
- No domain logic exists in routes
