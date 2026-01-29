# frontend_http_client.md — Canonical Frontend HTTP Client Contract (v1)

Balance Kitchen is framework-free and security-first.
To prevent transport drift, **all frontend HTTP must go through one canonical client**.

## Non-negotiables

- `fetch()` is **forbidden** in UI/page/component code.
- `fetch()` is **allowed only** inside: `src/frontend/lib/http-client.ts`
- UI code must call:
  - `httpGet<T>(url)`
  - `httpPost<T>(url, body)`
  - `httpPut<T>(url, body)`
  - `httpDelete<T>(url)`

Any PR that introduces `fetch()` outside the canonical client is **non-compliant**.

## Why this exists

Centralizing HTTP behavior ensures:

- consistent use of `credentials: "include"` for surface cookies
- consistent parsing of BalanceGuard envelopes
- consistent handling of network/CORS failures
- future observability: request timings, correlation IDs, retries, traces
- fewer security regressions (CORS, auth assumptions, error leakage)

## Server response contract (BalanceGuard envelope)

All BK HTTP endpoints must return JSON in one of these shapes.

### Success

```json
{ "ok": true, "request_id": "uuid", "data": { } }
```
