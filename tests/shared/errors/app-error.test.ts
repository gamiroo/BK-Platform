import test from "node:test";
import assert from "node:assert/strict";

import { AppError } from "../../../src/shared/errors/app-error.ts";

test("AppError: sets name/code/status/message", () => {
  const err = new AppError({
    code: "BAD_REQUEST",
    status: 400,
    message: "Bad input",
  });

  assert.equal(err.name, "AppError");
  assert.equal(err.code, "BAD_REQUEST");
  assert.equal(err.status, 400);
  assert.equal(err.message, "Bad input");
});

test("AppError: details preserved when provided", () => {
  const err = new AppError({
    code: "FORBIDDEN",
    status: 403,
    message: "Nope",
    details: { reason: "role_missing" },
  });

  assert.deepEqual(err.details, { reason: "role_missing" });
});

test("AppError: cause is assignable and preserved when provided", () => {
  const cause = new Error("root");
  const err = new AppError({
    code: "INTERNAL_ERROR",
    status: 500,
    message: "Unexpected error",
    cause,
  });

  // Not all TS lib configs type Error.cause, but runtime should keep it.
  const anyErr = err as unknown as { cause?: unknown };
  assert.equal(anyErr.cause, cause);
});

test("AppError: details is undefined when not provided (exactOptionalPropertyTypes-safe)", () => {
  const err = new AppError({
    code: "FORBIDDEN",
    status: 403,
    message: "Nope",
  });

  assert.equal(err.details, undefined);
});

