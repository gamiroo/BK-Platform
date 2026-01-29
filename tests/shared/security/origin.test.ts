// tests/shared/security/balanceguard/origin.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { enforceOrigin } from "../../../src/shared/security/balanceguard/origin.js";

type EnvSnapshot = Readonly<{
  NODE_ENV: string | undefined;
  BK_ORIGINS_SITE: string | undefined;
  BK_ORIGINS_CLIENT: string | undefined;
  BK_ORIGINS_ADMIN: string | undefined;
}>;

function snapshotEnv(): EnvSnapshot {
  return {
    NODE_ENV: process.env.NODE_ENV,
    BK_ORIGINS_SITE: process.env.BK_ORIGINS_SITE,
    BK_ORIGINS_CLIENT: process.env.BK_ORIGINS_CLIENT,
    BK_ORIGINS_ADMIN: process.env.BK_ORIGINS_ADMIN,
  };
}

function restoreEnv(s: EnvSnapshot): void {
  const apply = (k: keyof EnvSnapshot, v: string | undefined): void => {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  };

  apply("NODE_ENV", s.NODE_ENV);
  apply("BK_ORIGINS_SITE", s.BK_ORIGINS_SITE);
  apply("BK_ORIGINS_CLIENT", s.BK_ORIGINS_CLIENT);
  apply("BK_ORIGINS_ADMIN", s.BK_ORIGINS_ADMIN);
}

function reqWithOrigin(origin: string | null): Request {
  const headers = new Headers();
  if (origin !== null) headers.set("origin", origin);
  return new Request("http://localhost/api/site/enquiry", {
    method: "POST",
    headers,
  });
}

function assertOriginRejected(err: unknown, reason: string): void {
  assert.ok(err && typeof err === "object", "expected object error");

  const e = err as Record<string, unknown>;
  // AppError in this codebase typically exposes these fields.
  assert.equal(e["code"], "ORIGIN_REJECTED");
  assert.equal(e["status"], 403);

  const details = e["details"];
  assert.ok(details && typeof details === "object", "expected details object");
  assert.equal((details as Record<string, unknown>)["reason"], reason);
}

test.describe("balanceguard origin enforcement", { concurrency: 1 }, () => {
  test("dev: allowlist missing => warn-open (no throw)", () => {
    const snap = snapshotEnv();
    try {
      process.env.NODE_ENV = "development";
      delete process.env.BK_ORIGINS_SITE;

      assert.doesNotThrow(() => {
        enforceOrigin(reqWithOrigin("http://localhost:5173"), "site");
      });
    } finally {
      restoreEnv(snap);
    }
  });

  test("prod: allowlist missing => fail-closed (throw ORIGIN_REJECTED no_allowlist_configured)", () => {
    const snap = snapshotEnv();
    try {
      process.env.NODE_ENV = "production";
      delete process.env.BK_ORIGINS_SITE;

      assert.throws(
        () => {
          enforceOrigin(reqWithOrigin("https://example.com"), "site");
        },
        (err) => {
          assertOriginRejected(err, "no_allowlist_configured");
          return true;
        }
      );
    } finally {
      restoreEnv(snap);
    }
  });

  test("allowlist present: missing Origin header => throw ORIGIN_REJECTED missing_origin", () => {
    const snap = snapshotEnv();
    try {
      process.env.NODE_ENV = "production";
      process.env.BK_ORIGINS_SITE = "https://site.example.com";

      assert.throws(
        () => {
          enforceOrigin(reqWithOrigin(null), "site");
        },
        (err) => {
          assertOriginRejected(err, "missing_origin");
          return true;
        }
      );
    } finally {
      restoreEnv(snap);
    }
  });

  test("allowlist present: origin not allowed => throw ORIGIN_REJECTED origin_not_allowed", () => {
    const snap = snapshotEnv();
    try {
      process.env.NODE_ENV = "production";
      process.env.BK_ORIGINS_SITE = "https://site.example.com";

      assert.throws(
        () => {
          enforceOrigin(reqWithOrigin("https://evil.example.com"), "site");
        },
        (err) => {
          assertOriginRejected(err, "origin_not_allowed");
          return true;
        }
      );
    } finally {
      restoreEnv(snap);
    }
  });

  test("site: vercel preview origin allowed even if not in allowlist", () => {
    const snap = snapshotEnv();
    try {
      process.env.NODE_ENV = "production";
      process.env.BK_ORIGINS_SITE = "https://site.example.com";

      assert.doesNotThrow(() => {
        enforceOrigin(reqWithOrigin("https://site-abcdef.vercel.app"), "site");
      });
    } finally {
      restoreEnv(snap);
    }
  });

  test("client: vercel preview origin allowed with client prefix", () => {
    const snap = snapshotEnv();
    try {
      process.env.NODE_ENV = "production";
      process.env.BK_ORIGINS_CLIENT = "https://client.example.com";

      assert.doesNotThrow(() => {
        enforceOrigin(reqWithOrigin("https://client-abcdef.vercel.app"), "client");
      });
    } finally {
      restoreEnv(snap);
    }
  });

  test("admin: vercel preview origin allowed with admin prefix", () => {
    const snap = snapshotEnv();
    try {
      process.env.NODE_ENV = "production";
      process.env.BK_ORIGINS_ADMIN = "https://admin.example.com";

      assert.doesNotThrow(() => {
        enforceOrigin(reqWithOrigin("https://admin-abcdef.vercel.app"), "admin");
      });
    } finally {
      restoreEnv(snap);
    }
  });
});
