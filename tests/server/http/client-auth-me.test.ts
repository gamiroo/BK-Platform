import test from "node:test";
import assert from "node:assert/strict";

import { withServer, readJson, loginAndGetCookie } from "./helpers/http.js";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

test("client /auth/me: no cookie => 401 UNAUTHENTICATED", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/client/auth/me`, {
      method: "GET",
      headers: { accept: "application/json" },
    });

    assert.equal(res.status, 401);

    const body = await readJson(res);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "UNAUTHENTICATED");
  });
});

test("client /auth/me: wrong cookie only => 403 WRONG_SURFACE", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/client/auth/me`, {
      method: "GET",
      headers: {
        accept: "application/json",
        cookie: "bk_admin_session=some_admin_cookie",
      },
    });

    assert.equal(res.status, 403);

    const body = await readJson(res);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "WRONG_SURFACE");
    assert.ok(body.error.details !== undefined, "expected error.details");
  });
});

test("client /auth/me: login => 200 with data.actor.kind=client", async () => {
  await withServer(async (baseUrl) => {
    const cookie = await loginAndGetCookie(baseUrl, {
      surface: "client",
      email: "client@balance.local",
      password: "client_password",
    });

    const res = await fetch(`${baseUrl}/api/client/auth/me`, {
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
    assert.equal(actor["kind"], "client");
  });
});

test("client /auth/me: both cookies => 200 (client wins) with data.actor.kind=client", async () => {
  await withServer(async (baseUrl) => {
    const clientCookie = await loginAndGetCookie(baseUrl, {
      surface: "client"
    });

    const mixedCookie = `${clientCookie}; bk_admin_session=some_admin_cookie`;

    const res = await fetch(`${baseUrl}/api/client/auth/me`, {
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
    assert.equal(actor["kind"], "client");
  });
});
