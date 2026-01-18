// tests/shared/errors/normalize-error.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { normalizeError } from "../../../src/shared/errors/normalize-error.ts";
import { AppError } from "../../../src/shared/errors/app-error.ts";

test("normalizeError: AppError preserves code/status/message and includes details only when present", () => {
  const err = new AppError({
    code: "FORBIDDEN",
    status: 403,
    message: "Nope",
    details: { reason: "role_missing" },
  });

  const n = normalizeError(err);

  assert.equal(n.code, "FORBIDDEN");
  assert.equal(n.status, 403);
  assert.equal(n.publicMessage, "Nope");
  assert.match(n.logMessage, /FORBIDDEN/);
  assert.deepEqual(n.details, { reason: "role_missing" });
});

test("normalizeError: AppError without details omits details field", () => {
  const err = new AppError({
    code: "BAD_REQUEST",
    status: 400,
    message: "Bad input",
  });

  const n = normalizeError(err);

  assert.equal(n.code, "BAD_REQUEST");
  assert.equal(n.status, 400);
  assert.equal(n.publicMessage, "Bad input");
  assert.ok(!("details" in n), "details should be omitted when undefined");
});

test("normalizeError: native Error becomes INTERNAL_ERROR 500 with generic public message", () => {
  const err = new Error("Boom");

  const n = normalizeError(err);

  assert.equal(n.code, "INTERNAL_ERROR");
  assert.equal(n.status, 500);
  assert.equal(n.publicMessage, "Unexpected error");
  assert.equal(n.logMessage, "Boom");
  // Details may include stack/name for logs; never rely on exact stack content
  if (n.details) {
    assert.equal(n.details.name, "Error");
  }
});

test("normalizeError: non-Error throw becomes INTERNAL_ERROR 500", () => {
  const n = normalizeError("nope");

  assert.equal(n.code, "INTERNAL_ERROR");
  assert.equal(n.status, 500);
  assert.equal(n.publicMessage, "Unexpected error");
  assert.match(n.logMessage, /Non-error thrown/);
});
