import test from "node:test";
import assert from "node:assert/strict";
import type http from "node:http";

import { startHttpServer } from "../../../src/server/http/server.js";

type JsonEnvelope =
  | Readonly<{ ok: true; request_id: string; data: unknown }>
  | Readonly<{
      ok: false;
      request_id: string;
      error: Readonly<{ code: string; message: string; details?: unknown }>;
    }>;

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

test("client /auth/logout: missing CSRF => 403 (CSRF required)", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/client/auth/logout`, {
      method: "POST",
      headers: {
        accept: "application/json",
      },
    });

    assert.equal(res.status, 403);

    const body = await readJson(res);
    assert.equal(body.ok, false);

    assert.ok(typeof body.error.code === "string");
    assert.ok(typeof body.error.message === "string");
    assert.ok(!("stack" in (body.error as unknown as Record<string, unknown>)));
  });
});
