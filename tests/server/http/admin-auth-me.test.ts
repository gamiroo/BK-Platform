import test from "node:test";
import assert from "node:assert/strict";
import type http from "node:http";

import { startHttpServer } from "../../../src/server/http/server.js";

type JsonEnvelope =
  | Readonly<{ ok: true; request_id: string; data: unknown }>
  | Readonly<{ ok: false; request_id: string; error: Readonly<{ code: string; message: string; details?: unknown }> }>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

async function readJson(res: Response): Promise<JsonEnvelope> {
  const text = await res.text();
  assert.ok(text.length > 0, "expected JSON response body");
  const parsed = JSON.parse(text) as unknown;
  assert.ok(isRecord(parsed), "expected JSON object");
  assert.ok(typeof parsed["ok"] === "boolean", "expected ok boolean");
  assert.ok(typeof parsed["request_id"] === "string", "expected request_id string");
  return parsed as JsonEnvelope;
}

async function withServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
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
        cookie: "bk_client_session=dev_client_cookie",
      },
    });

    assert.equal(res.status, 403);

    const body = await readJson(res);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "WRONG_SURFACE");
    assert.ok(body.error.details !== undefined, "expected error.details");
  });
});

test("admin /auth/me: correct cookie => 200 with data.actor.kind=admin", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/admin/auth/me`, {
      method: "GET",
      headers: {
        accept: "application/json",
        cookie: "bk_admin_session=dev_admin_cookie",
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
    const res = await fetch(`${baseUrl}/api/admin/auth/me`, {
      method: "GET",
      headers: {
        accept: "application/json",
        cookie: "bk_admin_session=dev_admin_cookie; bk_client_session=dev_client_cookie",
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
