// src/frontend/lib/http-client.ts
//
// Canonical frontend HTTP client for Balance Kitchen.
//
// ✅ Non-negotiables
// - This is the ONLY place where `fetch()` is allowed.
// - All UI code must call helpers from this file.
// - This file enforces: credentials, JSON envelopes, and safe error normalization.
//
// Why this exists:
// - Prevents "fetch drift" (headers/credentials inconsistencies)
// - Centralizes envelope parsing and error semantics
// - Creates a single point to add: tracing, timings, retry policy, CSRF helpers, etc.
//
// IMPORTANT:
// - Backend is expected to respond with the canonical envelope:
//   Success: { ok:true,  request_id, data }
//   Error:   { ok:false, request_id, error:{ code, message, ... } }

export type HttpError = Readonly<{
  code: string;
  message: string;
  request_id?: string;
}>;

export type HttpOk<T> = Readonly<{
  ok: true;
  data: T;
  request_id?: string;
}>;

export type HttpFail = Readonly<{
  ok: false;
  error: HttpError;
  request_id?: string;
}>;

export type HttpResponse<T> = HttpOk<T> | HttpFail;

/**
 * Typed error for pages that prefer try/catch instead of union checking.
 *
 * Usage:
 *   const r = await httpPost<Thing>(...);
 *   const data = expectOk(r); // throws HttpClientError on {ok:false}
 */
export class HttpClientError extends Error {
  public readonly code: string;
  public readonly request_id?: string;

  constructor(params: { code: string; message: string; request_id?: string }) {
    super(params.message);
    this.name = "HttpClientError";
    this.code = params.code;

    // exactOptionalPropertyTypes: do NOT assign undefined to an optional prop.
    if (params.request_id !== undefined) {
      this.request_id = params.request_id;
    }
  }
}

/**
 * Convert an HttpResponse<T> into T or throw HttpClientError.
 * This keeps UI code clean and standardized.
 */
export function expectOk<T>(r: HttpResponse<T>): T {
  if (r.ok) return r.data;

  const rid = r.error.request_id ?? r.request_id;

  throw new HttpClientError({
    code: r.error.code,
    message: r.error.message,
    ...(rid !== undefined ? { request_id: rid } : {}),
  });
}

/**
 * Dev-only HTTP logger.
 *
 * Goals:
 * - zero production noise
 * - consistent visibility while building UI
 * - easy to remove/upgrade later
 *
 * NOTE:
 * We intentionally avoid importing any server/shared logger here.
 * Frontend logging should remain lightweight and dependency-free.
 */
function isDev(): boolean {
  // Vite-style flag (works in your Vite builds).
  // Wrapped in try/catch to avoid runtime issues in non-Vite environments.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = import.meta as any;
    if (meta?.env?.DEV === true) return true;
  } catch {
    // ignore
  }

  // Safe fallback for local dev without relying on bundler defines.
  // (Works in browsers only.)
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") return true;
  }

  return false;
}

function devLog(event: Record<string, unknown>): void {
  if (!isDev()) return;

  // Keep logs compact + searchable.
  // eslint-disable-next-line no-console
  console.info("[bk:http]", event);
}

function safeNow(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

/**
 * Internal helper that performs the actual fetch.
 * Never export this directly.
 */
async function doFetch<T>(input: RequestInfo, init: RequestInit): Promise<HttpResponse<T>> {
  const t0 = safeNow();

  let res: Response;
  try {
    res = await fetch(input, {
      ...init,
      credentials: "include", // REQUIRED for surface session cookies
      headers: {
        // Default JSON content-type for our APIs.
        // Callers can override/extend via init.headers.
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch {
    // Network / CORS / DNS failure:
    // We intentionally return an envelope-shaped failure so the UI can render safely.
    devLog({
      ok: false,
      phase: "network_error",
      method: init.method ?? "GET",
      url: String(input),
      ms: Math.round(safeNow() - t0),
    });

    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Unable to reach server",
      },
    };
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    devLog({
      ok: false,
      phase: "invalid_content_type",
      method: init.method ?? "GET",
      url: String(input),
      status: res.status,
      content_type: ct,
      ms: Math.round(safeNow() - t0),
    });

    return {
      ok: false,
      error: {
        code: "INVALID_RESPONSE",
        message: "Unexpected server response",
      },
    };
  }

  // Read text first so we can gracefully handle empty/invalid JSON.
  const raw = await res.text();
  if (!raw) {
    devLog({
      ok: false,
      phase: "empty_json",
      method: init.method ?? "GET",
      url: String(input),
      status: res.status,
      ms: Math.round(safeNow() - t0),
    });

    return {
      ok: false,
      error: {
        code: "INVALID_RESPONSE",
        message: "Unexpected empty response",
      },
    };
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    devLog({
      ok: false,
      phase: "json_parse_error",
      method: init.method ?? "GET",
      url: String(input),
      status: res.status,
      ms: Math.round(safeNow() - t0),
    });

    return {
      ok: false,
      error: {
        code: "INVALID_RESPONSE",
        message: "Invalid JSON response",
      },
    };
  }

  // We assume the backend returns the canonical envelope.
  // We still log helpful details in dev.
  const out = body as HttpResponse<T>;

  devLog({
    ok: out.ok,
    method: init.method ?? "GET",
    url: String(input),
    status: res.status,
    request_id: (out as { request_id?: string }).request_id,
    code: !out.ok ? out.error.code : undefined,
    ms: Math.round(safeNow() - t0),
  });

  return out;
}

/** Perform a GET request. */
export function httpGet<T>(url: string): Promise<HttpResponse<T>> {
  return doFetch<T>(url, { method: "GET" });
}

/** Perform a POST request with JSON body. */
export function httpPost<T>(url: string, body: unknown): Promise<HttpResponse<T>> {
  return doFetch<T>(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Perform a PUT request with JSON body. */
export function httpPut<T>(url: string, body: unknown): Promise<HttpResponse<T>> {
  return doFetch<T>(url, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/** Perform a DELETE request. */
export function httpDelete<T>(url: string): Promise<HttpResponse<T>> {
  return doFetch<T>(url, { method: "DELETE" });
}
