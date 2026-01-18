// tests/shared/security/csrf.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { enforceCsrf } from "../../../src/shared/security/balanceguard/csrf.ts";
import { AppError } from "../../../src/shared/errors/app-error.ts";

function makeReq(opts: { headerToken?: string; cookieToken?: string }): Request {
  const headers = new Headers();

  if (opts.headerToken) headers.set("x-csrf-token", opts.headerToken);
  if (opts.cookieToken) headers.set("cookie", `bk_csrf=${encodeURIComponent(opts.cookieToken)}`);

  return new Request("http://example.test/unsafe", { method: "POST", headers });
}

test("enforceCsrf: missing header token -> CSRF_REQUIRED", () => {
  const req = makeReq({ cookieToken: "abc" });

  assert.throws(
    () => enforceCsrf(req),
    (e: unknown) => {
      assert.ok(e instanceof AppError);
      assert.equal(e.code, "CSRF_REQUIRED");
      assert.equal(e.status, 403);
      return true;
    }
  );
});

test("enforceCsrf: missing cookie token -> CSRF_INVALID", () => {
  const req = makeReq({ headerToken: "abc" });

  assert.throws(
    () => enforceCsrf(req),
    (e: unknown) => {
      assert.ok(e instanceof AppError);
      assert.equal(e.code, "CSRF_INVALID");
      assert.equal(e.status, 403);
      return true;
    }
  );
});

test("enforceCsrf: mismatch -> CSRF_INVALID", () => {
  const req = makeReq({ headerToken: "abc", cookieToken: "xyz" });

  assert.throws(
    () => enforceCsrf(req),
    (e: unknown) => {
      assert.ok(e instanceof AppError);
      assert.equal(e.code, "CSRF_INVALID");
      assert.equal(e.status, 403);
      return true;
    }
  );
});

test("enforceCsrf: match passes", () => {
  const req = makeReq({ headerToken: "abc", cookieToken: "abc" });
  assert.doesNotThrow(() => enforceCsrf(req));
});
