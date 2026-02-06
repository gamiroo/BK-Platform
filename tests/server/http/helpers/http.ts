// tests/server/http/helpers/http.ts
/**
 * Minimal HTTP test helper (Node test runner).
 *
 * Why this exists:
 * - Avoid repeating server boot/shutdown code in every test.
 * - Provide stable helpers for:
 *   - login (capture Set-Cookie)
 *   - authenticated requests (Cookie header)
 *   - CSRF test setup (cookie + header)
 *
 * IMPORTANT:
 * - Tests SHOULD use fetch() directly.
 * - The "no raw fetch in UI" rule is for frontend runtime code ONLY.
 */

import assert from "node:assert/strict";
import type http from "node:http";
import { startHttpServer } from "../../../../src/server/http/server.js";

export type JsonEnvelope =
  | Readonly<{ ok: true; request_id: string; data: unknown }>
  | Readonly<{
      ok: false;
      request_id: string;
      error: Readonly<{ code: string; message: string; details?: unknown }>;
    }>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export async function readJson(res: Response): Promise<JsonEnvelope> {
  const text = await res.text();
  assert.ok(text.length > 0, "expected JSON response body");
  const parsed = JSON.parse(text) as unknown;
  assert.ok(isRecord(parsed), "expected JSON object");
  assert.ok(typeof parsed["ok"] === "boolean", "expected ok boolean");
  assert.ok(typeof parsed["request_id"] === "string", "expected request_id string");
  return parsed as JsonEnvelope;
}

/**
 * Boot a real HTTP server on an ephemeral port for each test.
 */
export async function withServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const server: http.Server = startHttpServer(0);

  await new Promise<void>((resolve) => {
    if (server.listening) resolve();
    else server.once("listening", () => resolve());
  });

  const addr = server.address();
  assert.ok(addr && typeof addr === "object", "expected server address");
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    return await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

/**
 * Extract the cookie KV pair from a Set-Cookie header string.
 * For tests we only need "name=value" (we ignore attributes).
 */
export function cookieKvFromSetCookie(setCookie: string): string {
  // Example: "bk_admin_session=abc123; Path=/; HttpOnly; SameSite=Lax"
  const first = setCookie.split(";")[0];
  // TS safety: split(";") always returns at least 1 item, but keep assert for clarity.
  assert.ok(first !== undefined && first.length > 0, "expected Set-Cookie to contain name=value");
  return first.trim();
}

/**
 * Node fetch (undici) does NOT reliably expose Set-Cookie via headers.get("set-cookie").
 *
 * In Node 20+, the correct API is:
 *   res.headers.getSetCookie(): string[]
 *
 * This helper supports both:
 * - Node's getSetCookie() (preferred)
 * - fallback to headers.get("set-cookie") for compatibility
 */
function getSetCookies(res: Response): string[] {
  const h = res.headers as unknown as { getSetCookie?: () => string[] };

  if (typeof h.getSetCookie === "function") {
    return h.getSetCookie();
  }

  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

/**
 * Default deterministic seed credentials (must match MemoryIdentityRepository seed).
 *
 * If you change the seed, update these defaults.
 */
const DEFAULT_CREDS = {
  admin: { email: "admin@balance.local", password: "admin_password" },
  client: { email: "client@balance.local", password: "client_password" },
} as const;

/**
 * Login helper:
 * - Calls /api/{surface}/auth/login
 * - Adds Origin header (BalanceGuard requireOrigin will otherwise block Node fetch)
 * - Returns a Cookie header value that can be re-used on subsequent requests.
 */
export async function loginAndGetCookie(
  baseUrl: string,
  opts: Readonly<{
    surface: "admin" | "client";
    email?: string;
    password?: string;
  }>
): Promise<string> {
  const defaults = DEFAULT_CREDS[opts.surface];

  const email = opts.email ?? defaults.email;
  const password = opts.password ?? defaults.password;

  const res = await fetch(`${baseUrl}/api/${opts.surface}/auth/login`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",

      /**
       * ✅ Critical for BalanceGuard origin enforcement:
       * Browsers automatically send Origin on POSTs; Node fetch does not.
       *
       * Using baseUrl as Origin makes the request "same-origin" for our test server.
       */
      origin: baseUrl,
    },
    body: JSON.stringify({ email, password }),
  });

  // Tests calling this helper expect success.
  assert.equal(res.status, 200, "expected login 200");

  const cookies = getSetCookies(res);
  assert.ok(cookies.length > 0, "expected Set-Cookie header(s) from login");

  // We set exactly one session cookie for login routes; take the first.
  return cookieKvFromSetCookie(cookies[0]!);
}

/**
 * CSRF setup for logout tests.
 *
 * Your BalanceGuard CSRF expects:
 * - header: x-csrf-token
 * - cookie: bk_csrf
 *
 * In v1 scaffold, token must match cookie value.
 */
export function withCsrfCookie(cookieHeader: string, surface: "admin" | "client", token: string): string {
  const name = surface === "admin" ? "bk_csrf_admin" : "bk_csrf_client";
  return `${cookieHeader}; ${name}=${encodeURIComponent(token)}`;
}


