// tests/server/http/site-enquiry-origin.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { Router } from "../../../src/server/http/router.js";
import { createRequestContext } from "../../../src/shared/logging/request-context.js";
import type { RequestContext } from "../../../src/shared/logging/request-context.js";
import { balanceguardSite } from "../../../src/shared/security/balanceguard/wrappers.js";

type EnvSnapshot = Readonly<{
  NODE_ENV: string | undefined;
  BK_ORIGINS_SITE: string | undefined;
}>;

function snapshotEnv(): EnvSnapshot {
  return {
    NODE_ENV: process.env.NODE_ENV,
    BK_ORIGINS_SITE: process.env.BK_ORIGINS_SITE,
  };
}

function restoreEnv(s: EnvSnapshot): void {
  if (s.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = s.NODE_ENV;

  if (s.BK_ORIGINS_SITE === undefined) delete process.env.BK_ORIGINS_SITE;
  else process.env.BK_ORIGINS_SITE = s.BK_ORIGINS_SITE;
}

function jsonResponse(status: number, data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function makeRouterWithStubEnquiry(): Router {
  const r = new Router();

  r.post(
    "/api/site/enquiry",
    balanceguardSite(
      {
        requireOrigin: true,
        requireCsrf: false,
        requireAuth: false,
        rateLimit: { max: 10, windowMs: 60_000 },
      },
      async (_ctx: RequestContext, _req: Request) => {
        return jsonResponse(201, { lead_id: "test_lead_id" });
      }
    )
  );

  return r;
}

function makeEnquiryRequest(origin: string | null): Request {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  if (origin !== null) headers.set("origin", origin);

  return new Request("http://localhost:3000/api/site/enquiry", {
    method: "POST",
    headers,
    body: JSON.stringify({
      lastName: "Test",
      email: "test@example.com",
      message: "Hello",
    }),
  });
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  assert.ok(text.length > 0, "expected non-empty JSON response body");
  return JSON.parse(text) as unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

test.describe(
  "POST /api/site/enquiry origin enforcement (BalanceGuard boundary)",
  { concurrency: 1 },
  () => {
    test("allowlisted origin => succeeds", async () => {
      const snap = snapshotEnv();
      try {
        // Important:
        // We keep wrapper tests in NODE_ENV=test so BalanceGuard doesn't require
        // prod-only secrets/config. Origin enforcement still applies when the allowlist exists.
        process.env.NODE_ENV = "test";
        process.env.BK_ORIGINS_SITE = "http://localhost:5173";

        const router = makeRouterWithStubEnquiry();
        const ctx = createRequestContext();

        const res = await router.handle(ctx, makeEnquiryRequest("http://localhost:5173"));
        assert.equal(res.status, 201);

        const body = await readJson(res);
        assert.ok(isRecord(body), "expected object JSON");
        const data = body["data"];
        assert.ok(isRecord(data), "expected { data: ... }");
        assert.equal(data["lead_id"], "test_lead_id");
      } finally {
        restoreEnv(snap);
      }
    });

    test("missing Origin header => 403 ORIGIN_REJECTED", async () => {
      const snap = snapshotEnv();
      try {
        process.env.NODE_ENV = "test";
        process.env.BK_ORIGINS_SITE = "http://localhost:5173";

        const router = makeRouterWithStubEnquiry();
        const ctx = createRequestContext();

        const res = await router.handle(ctx, makeEnquiryRequest(null));
        assert.equal(res.status, 403);

        const body = await readJson(res);
        assert.ok(isRecord(body), "expected object JSON");
        const err = body["error"];
        assert.ok(isRecord(err), "expected { error: ... }");
        assert.equal(err["code"], "ORIGIN_REJECTED");
      } finally {
        restoreEnv(snap);
      }
    });

    test("origin not allowlisted => 403 ORIGIN_REJECTED", async () => {
      const snap = snapshotEnv();
      try {
        process.env.NODE_ENV = "test";
        process.env.BK_ORIGINS_SITE = "http://localhost:5173";

        const router = makeRouterWithStubEnquiry();
        const ctx = createRequestContext();

        const res = await router.handle(ctx, makeEnquiryRequest("https://evil.example.com"));
        assert.equal(res.status, 403);

        const body = await readJson(res);
        assert.ok(isRecord(body), "expected object JSON");
        const err = body["error"];
        assert.ok(isRecord(err), "expected { error: ... }");
        assert.equal(err["code"], "ORIGIN_REJECTED");
      } finally {
        restoreEnv(snap);
      }
    });
  }
);
