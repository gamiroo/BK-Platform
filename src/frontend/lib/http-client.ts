// src/frontend/lib/http-client.ts
//
// Canonical frontend HTTP client for Balance Kitchen.
//
// ✅ Non-negotiables
// - This is the ONLY place where `fetch()` is allowed.
// - All UI code must call helpers from this file.
// - This file enforces: credentials, JSON envelopes, and safe error normalization.
//
// IMPORTANT:
// - Backend is expected to respond with the canonical envelope:
//   Success: { ok:true,  request_id, data }
//   Error:   { ok:false, request_id, error:{ code, message, ... } }
//
// CSRF:
// - For unsafe methods, we attach x-csrf-token if a per-surface CSRF cookie exists.
// - Legacy cookie support removed (no bk_csrf fallback).

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

export class HttpClientError extends Error {
  public readonly code: string;
  public readonly request_id?: string;

  constructor(params: { code: string; message: string; request_id?: string }) {
    super(params.message);
    this.name = "HttpClientError";
    this.code = params.code;
    if (params.request_id !== undefined) this.request_id = params.request_id;
  }
}

export function expectOk<T>(r: HttpResponse<T>): T {
  if (r.ok) return r.data;

  const rid = r.error.request_id ?? r.request_id;

  throw new HttpClientError({
    code: r.error.code,
    message: r.error.message,
    ...(rid !== undefined ? { request_id: rid } : {}),
  });
}

function isDev(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = import.meta as any;
    if (meta?.env?.DEV === true) return true;
  } catch {
    // ignore
  }

  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") return true;
  }

  return false;
}

function devLog(event: Record<string, unknown>): void {
  if (!isDev()) return;
  // eslint-disable-next-line no-console
  console.info("[bk:http]", event);
}

function safeNow(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function parseDocumentCookies(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const raw = document.cookie ?? "";
  const out: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const k = trimmed.slice(0, idx).trim();
    const v = trimmed.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function csrfCookieNameForUrl(url: string): string | undefined {
  // Key off API surface prefix (same as backend routing).
  if (url.startsWith("/api/admin/") || url === "/api/admin") return "bk_csrf_admin";
  if (url.startsWith("/api/client/") || url === "/api/client") return "bk_csrf_client";
  return undefined;
}

function pickCsrfToken(url: string): string | undefined {
  const cookieName = csrfCookieNameForUrl(url);
  if (!cookieName) return undefined;

  const cookies = parseDocumentCookies();
  const v = cookies[cookieName];
  return v && v.length > 0 ? v : undefined;
}

function isUnsafeMethod(method: string): boolean {
  const m = method.toUpperCase();
  return m !== "GET" && m !== "HEAD" && m !== "OPTIONS";
}

/**
 * Internal helper that performs the actual fetch.
 * Never export this directly.
 */
async function doFetch<T>(input: RequestInfo, init: RequestInit): Promise<HttpResponse<T>> {
  const t0 = safeNow();

  const method = (init.method ?? "GET").toUpperCase();
  const url = String(input);

  // Build headers once so we can safely add CSRF without clobbering caller headers.
  const headers = new Headers(init.headers ?? {});
  headers.set("content-type", headers.get("content-type") ?? "application/json");

  // CSRF for unsafe methods (double-submit cookie).
  if (isUnsafeMethod(method)) {
    const token = pickCsrfToken(url);
    if (token) headers.set("x-csrf-token", token);
  }

  let res: Response;
  try {
    res = await fetch(input, {
      ...init,
      method,
      credentials: "include",
      headers,
    });
  } catch {
    devLog({
      ok: false,
      phase: "network_error",
      method,
      url,
      ms: Math.round(safeNow() - t0),
    });

    return {
      ok: false,
      error: { code: "NETWORK_ERROR", message: "Unable to reach server" },
    };
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    devLog({
      ok: false,
      phase: "invalid_content_type",
      method,
      url,
      status: res.status,
      content_type: ct,
      ms: Math.round(safeNow() - t0),
    });

    return {
      ok: false,
      error: { code: "INVALID_RESPONSE", message: "Unexpected server response" },
    };
  }

  const raw = await res.text();
  if (!raw) {
    devLog({
      ok: false,
      phase: "empty_json",
      method,
      url,
      status: res.status,
      ms: Math.round(safeNow() - t0),
    });

    return {
      ok: false,
      error: { code: "INVALID_RESPONSE", message: "Unexpected empty response" },
    };
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    devLog({
      ok: false,
      phase: "json_parse_error",
      method,
      url,
      status: res.status,
      ms: Math.round(safeNow() - t0),
    });

    return {
      ok: false,
      error: { code: "INVALID_RESPONSE", message: "Invalid JSON response" },
    };
  }

  const out = body as HttpResponse<T>;

  devLog({
    ok: out.ok,
    method,
    url,
    status: res.status,
    request_id: (out as { request_id?: string }).request_id,
    code: !out.ok ? out.error.code : undefined,
    ms: Math.round(safeNow() - t0),
  });

  return out;
}

export function httpGet<T>(url: string): Promise<HttpResponse<T>> {
  return doFetch<T>(url, { method: "GET" });
}

export function httpPost<T>(url: string, body: unknown): Promise<HttpResponse<T>> {
  return doFetch<T>(url, { method: "POST", body: JSON.stringify(body) });
}

export function httpPut<T>(url: string, body: unknown): Promise<HttpResponse<T>> {
  return doFetch<T>(url, { method: "PUT", body: JSON.stringify(body) });
}

export function httpDelete<T>(url: string): Promise<HttpResponse<T>> {
  return doFetch<T>(url, { method: "DELETE" });
}
