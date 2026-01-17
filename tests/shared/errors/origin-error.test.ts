// tests/shared/security/origin.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { enforceOrigin } from "../../../src/shared/security/balanceguard/origin.ts";
import { AppError } from "../../../src/shared/errors/app-error.ts";

function makeReq(origin: string | null): Request {
  const headers = new Headers();
  if (origin !== null) headers.set("origin", origin);
  return new Request("http://example.test/anything", { method: "GET", headers });
}

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    prev[k] = process.env[k];
    const v = vars[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }

  try {
    return fn();
  } finally {
    for (const k of Object.keys(vars)) {
      const v = prev[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("enforceOrigin: in production, missing allowlist fails closed", () => {
  withEnv(
    {
      NODE_ENV: "production",
      BK_ORIGINS_SITE: undefined,
      BK_ORIGINS_CLIENT: undefined,
      BK_ORIGINS_ADMIN: undefined,
    },
    () => {
      const req = makeReq("https://evil.test");
      assert.throws(
        () => enforceOrigin(req, "client"),
        (e: unknown) => {
          assert.ok(e instanceof AppError);
          assert.equal(e.code, "ORIGIN_REJECTED");
          assert.equal(e.status, 403);
          return true;
        }
      );
    }
  );
});

test("enforceOrigin: in development, missing allowlist does not block", () => {
  withEnv(
    {
      NODE_ENV: "development",
      BK_ORIGINS_CLIENT: undefined,
    },
    () => {
      const req = makeReq(null);
      assert.doesNotThrow(() => enforceOrigin(req, "client"));
    }
  );
});

test("enforceOrigin: missing Origin header is rejected when allowlist exists", () => {
  withEnv(
    {
      NODE_ENV: "production",
      BK_ORIGINS_CLIENT: "https://client.example.test",
    },
    () => {
      const req = makeReq(null);
      assert.throws(
        () => enforceOrigin(req, "client"),
        (e: unknown) => {
          assert.ok(e instanceof AppError);
          assert.equal(e.code, "ORIGIN_REJECTED");
          assert.equal(e.status, 403);
          return true;
        }
      );
    }
  );
});

test("enforceOrigin: disallowed origin rejected", () => {
  withEnv(
    {
      NODE_ENV: "production",
      BK_ORIGINS_CLIENT: "https://client.example.test",
    },
    () => {
      const req = makeReq("https://evil.test");
      assert.throws(
        () => enforceOrigin(req, "client"),
        (e: unknown) => {
          assert.ok(e instanceof AppError);
          assert.equal(e.code, "ORIGIN_REJECTED");
          assert.equal(e.status, 403);
          return true;
        }
      );
    }
  );
});

test("enforceOrigin: allowed origin passes (csv allowlist)", () => {
  withEnv(
    {
      NODE_ENV: "production",
      BK_ORIGINS_CLIENT: "https://a.test, https://b.test",
    },
    () => {
      const req = makeReq("https://b.test");
      assert.doesNotThrow(() => enforceOrigin(req, "client"));
    }
  );
});
