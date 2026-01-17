// tests/shared/validation/validate.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { validate } from "../../../src/shared/validation/validate.ts";
import { AppError } from "../../../src/shared/errors/app-error.ts";

test("validate: returns validator result when valid", () => {
  const out = validate((x) => {
    if (typeof x !== "string") throw new Error("Expected string");
    return x.toUpperCase();
  }, "ok");

  assert.equal(out, "OK");
});

test("validate: throws AppError VALIDATION_FAILED when validator throws", () => {
  assert.throws(
    () =>
      validate(() => {
        throw new Error("nope");
      }, 123),
    (e: unknown) => {
      assert.ok(e instanceof AppError);
      assert.equal(e.code, "VALIDATION_FAILED");
      assert.equal(e.status, 400);
      assert.equal(e.message, "Validation failed");
      return true;
    }
  );
});
