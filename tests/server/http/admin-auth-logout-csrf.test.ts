// tests/server/http/admin-auth-logout-csrf.test.ts
/**
 * Admin logout CSRF contract tests.
 *
 * Goals:
 * - Logout is state-changing => MUST be CSRF protected (403 CSRF_REQUIRED).
 * - With valid CSRF => logout succeeds (200) and invalidates the session.
 * - After logout => /auth/me is unauthenticated (401 UNAUTHENTICATED).
 *
 * Notes:
 * - Production auth validates a real server-side session => tests must create sessions via /auth/login.
 * - Keep assertions resilient: assert stable envelope fields and safe actor markers only.
 *
 * Debugging:
 * - If a request returns an unexpected status, fail with the response body included.
 *   This avoids relying on console output (which can be suppressed in some runners).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { withServer, readJson, loginAndGetCookie, withCsrfCookie } from "./helpers/http.js";

const JSON_HEADERS = { accept: "application/json" } as const;

type OkEnvelope = { ok: true; data: unknown };
type ErrEnvelope = { ok: false; error: { code: string } };

function assertOkEnvelope(body: unknown): asserts body is OkEnvelope {
  assert.ok(typeof body === "object" && body !== null, "expected JSON object");
  const b = body as Record<string, unknown>;
  assert.equal(b["ok"], true);
}

function assertErrEnvelope(body: unknown): asserts body is ErrEnvelope {
  assert.ok(typeof body === "object" && body !== null, "expected JSON object");
  const b = body as Record<string, unknown>;
  assert.equal(b["ok"], false);

  const err = b["error"];
  assert.ok(typeof err === "object" && err !== null, "expected error object");

  const e = err as Record<string, unknown>;
  assert.equal(typeof e["code"], "string");
}

async function mustStatus(res: Response, expected: number, label: string): Promise<void> {
  if (res.status === expected) return;

  // Read body (best effort) and include it in the thrown error so it always surfaces in test output.
  const bodyText = await res.text().catch(() => "<failed to read body>");
  throw new Error(`${label}: expected ${expected}, got ${res.status}. Body: ${bodyText}`);
}

async function fetchJson(args: {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
}): Promise<{ res: Response; body: unknown }> {
  const res = await fetch(args.url, { method: args.method, headers: args.headers });
  const body = await readJson(res);
  return { res, body };
}

test("admin /auth/logout: missing CSRF => 403 (CSRF required)", async () => {
  await withServer(async (baseUrl) => {
    const adminCookie = await loginAndGetCookie(baseUrl, { surface: "admin" });

    const res = await fetch(`${baseUrl}/api/admin/auth/logout`, {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        cookie: adminCookie,
        // ❌ no x-csrf-token header
      },
    });

    await mustStatus(res, 403, "admin logout missing csrf");

    const body = await readJson(res);
    assertErrEnvelope(body);
    assert.equal(body.error.code, "CSRF_REQUIRED");
  });
});

test("admin /auth/logout: with CSRF => 200 and session invalidated", async () => {
  await withServer(async (baseUrl) => {
    const adminCookie = await loginAndGetCookie(baseUrl, { surface: "admin" });

    // Sanity: /auth/me should succeed while logged in.
    {
      const { res, body } = await fetchJson({
        url: `${baseUrl}/api/admin/auth/me`,
        method: "GET",
        headers: {
          ...JSON_HEADERS,
          cookie: adminCookie,
        },
      });

      await mustStatus(res, 200, "admin me while logged in");

      assertOkEnvelope(body);
      const data = body.data as Record<string, unknown>;
      const actor = data["actor"];
      assert.ok(typeof actor === "object" && actor !== null, "expected data.actor object");
    }

    // ✅ Provide CSRF in both cookie and header.
    const token = "test_csrf_token";
    const cookieWithCsrf = withCsrfCookie(adminCookie, "admin", token);

    const logoutRes = await fetch(`${baseUrl}/api/admin/auth/logout`, {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        cookie: cookieWithCsrf,
        "x-csrf-token": token,
        origin: baseUrl,
      },
    });

    await mustStatus(logoutRes, 200, "admin logout with csrf");

    // After logout, /auth/me must be unauthenticated.
    {
      const meRes = await fetch(`${baseUrl}/api/admin/auth/me`, {
        method: "GET",
        headers: {
          ...JSON_HEADERS,
          cookie: adminCookie, // original cookie should no longer map to a valid server session
          origin: baseUrl,
        },
      });

      await mustStatus(meRes, 401, "admin me after logout");

      const body = await readJson(meRes);
      assertErrEnvelope(body);
      assert.equal(body.error.code, "UNAUTHENTICATED");
    }
  });
});

test("admin /auth/me: both cookies => admin wins", async () => {
  await withServer(async (baseUrl) => {
    const adminCookie = await loginAndGetCookie(baseUrl, { surface: "admin" });
    const clientCookie = await loginAndGetCookie(baseUrl, { surface: "client" });

    const cookieHeader = `${adminCookie}; ${clientCookie}`;

    const res = await fetch(`${baseUrl}/api/admin/auth/me`, {
      method: "GET",
      headers: {
        ...JSON_HEADERS,
        cookie: cookieHeader,
        origin: baseUrl,
      },
    });

    await mustStatus(res, 200, "admin me with both cookies");

    const body = await readJson(res);
    assertOkEnvelope(body);

    const data = body.data as Record<string, unknown>;
    assert.ok(typeof data === "object" && data !== null);

    const actor = data["actor"];
    assert.ok(typeof actor === "object" && actor !== null);

    const actorRec = actor as Record<string, unknown>;
    assert.equal(actorRec["kind"], "admin");
  });
});
