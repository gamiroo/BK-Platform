import test from "node:test";
import assert from "node:assert/strict";

import { withServer, readJson, loginAndGetCookie } from "./helpers/http.js";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

test("admin /auth/me: no cookie => 401 UNAUTHENTICATED", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/admin/auth/me`, {
      method: "GET",
      headers: { accept: "application/json" },
    });

    assert.equal(res.status, 401);

    const body = await readJson(res);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "UNAUTHENTICATED");
  });
});

test("admin /auth/me: wrong cookie only => 403 WRONG_SURFACE", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/admin/auth/me`, {
      method: "GET",
      headers: {
        accept: "application/json",
        cookie: "bk_client_session=some_client_cookie",
      },
    });

    assert.equal(res.status, 403);

    const body = await readJson(res);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "WRONG_SURFACE");
    assert.ok(body.error.details !== undefined, "expected error.details");
  });
});

test("admin /auth/me: login => 200 with data.actor.kind=admin", async () => {
  await withServer(async (baseUrl) => {
    // ✅ Use real login to obtain a real session cookie.
    const cookie = await loginAndGetCookie(baseUrl, {
      surface: "admin"
    });

    const res = await fetch(`${baseUrl}/api/admin/auth/me`, {
      method: "GET",
      headers: {
        accept: "application/json",
        cookie,
      },
    });

    assert.equal(res.status, 200);

    const body = await readJson(res);
    assert.equal(body.ok, true);

    assert.ok(isRecord(body.data), "expected data object");
    const actor = body.data["actor"];
    assert.ok(isRecord(actor), "expected data.actor object");
    assert.equal(actor["kind"], "admin");
  });
});

test("admin /auth/me: both cookies => 200 (admin wins) with data.actor.kind=admin", async () => {
  await withServer(async (baseUrl) => {
    const adminCookie = await loginAndGetCookie(baseUrl, {
      surface: "admin",
      email: "admin@balance.local",
      password: "admin_password",
    });

    // Add a client cookie too. Admin surface should still resolve as admin.
    const mixedCookie = `${adminCookie}; bk_client_session=some_client_cookie`;

    const res = await fetch(`${baseUrl}/api/admin/auth/me`, {
      method: "GET",
      headers: {
        accept: "application/json",
        cookie: mixedCookie,
      },
    });

    assert.equal(res.status, 200);

    const body = await readJson(res);
    assert.equal(body.ok, true);

    assert.ok(isRecord(body.data), "expected data object");
    const actor = body.data["actor"];
    assert.ok(isRecord(actor), "expected data.actor object");
    assert.equal(actor["kind"], "admin");
  });
});
