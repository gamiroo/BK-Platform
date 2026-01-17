// src/shared/validation/validate.ts
/**
 * Minimal validation helper.
 *
 * We intentionally keep this dependency-free for Day 1.
 * You can later swap in Zod/Valibot and keep this function's API stable.
 */

import { AppError } from "../errors/app-error.js";

export type Validator<T> = (input: unknown) => T;

export function validate<T>(validator: Validator<T>, input: unknown): T {
  try {
    return validator(input);
  } catch (err) {
    // Never leak validator internal errors to clients.
    throw new AppError({
      code: "VALIDATION_FAILED",
      status: 400,
      message: "Validation failed",
      details: { reason: err instanceof Error ? err.message : String(err) },
    });
  }
}
