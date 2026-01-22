// tests/shared/security/balanceguard/authz.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { AppError } from "../../../../src/shared/errors/app-error.js";
import { enforceAuthz } from "../../../../src/shared/security/balanceguard/authz.js";
import type { Actor } from "../../../../src/shared/security/balanceguard/types.js";

function mustThrow(fn: () => void): AppError {
  try {
    fn();
    assert.fail("expected throw");
  } catch (err) {
    assert.ok(err instanceof AppError);
    return err;
  }
}

test("enforceAuthz: site allows anon", () => {
  const actor: Actor = { type: "anon" };
  enforceAuthz({ surface: "site", actor });
});

test("enforceAuthz: client requires session (AUTH_REQUIRED)", () => {
  const actor: Actor = { type: "anon" };
  const e = mustThrow(() => enforceAuthz({ surface: "client", actor }));
  assert.equal(e.code, "AUTH_REQUIRED");
  assert.equal(e.status, 401);
});

test("enforceAuthz: admin requires session (AUTH_REQUIRED)", () => {
  const actor: Actor = { type: "anon" };
  const e = mustThrow(() => enforceAuthz({ surface: "admin", actor }));
  assert.equal(e.code, "AUTH_REQUIRED");
  assert.equal(e.status, 401);
});

test("enforceAuthz: client forbids admin actor", () => {
  const actor: Actor = { type: "admin", admin_id: "a1" };
  const e = mustThrow(() => enforceAuthz({ surface: "client", actor }));
  assert.equal(e.code, "FORBIDDEN");
  assert.equal(e.status, 403);
});

test("enforceAuthz: admin forbids client actor", () => {
  const actor: Actor = { type: "client", client_id: "c1" };
  const e = mustThrow(() => enforceAuthz({ surface: "admin", actor }));
  assert.equal(e.code, "FORBIDDEN");
  assert.equal(e.status, 403);
});

test("enforceAuthz: client allows client actor", () => {
  const actor: Actor = { type: "client", client_id: "c1" };
  enforceAuthz({ surface: "client", actor });
});

test("enforceAuthz: admin allows admin actor", () => {
  const actor: Actor = { type: "admin", admin_id: "a1" };
  enforceAuthz({ surface: "admin", actor });
});
