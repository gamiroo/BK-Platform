// src/shared/errors/normalize-error.ts
/**
 * Normalize unknown errors into a safe, consistent shape.
 *
 * This is used at the transport boundary (BalanceGuard, server adapter, WS entry).
 * It ensures:
 * - clients get safe, non-leaky messages
 * - logs still capture actionable metadata
 */

import { AppError } from "./app-error.js";
import type { ErrorCode } from "./error-codes.js";

export type NormalizedError = Readonly<{
  code: ErrorCode;
  status: number;

  /**
   * Safe public message for clients.
   * Keep generic for INTERNAL_ERROR.
   */
  publicMessage: string;

  /**
   * A more detailed message for logs (still should not contain secrets).
   */
  logMessage: string;

  /**
   * Optional log details.
   */
  details?: Record<string, unknown>;
}>;

export function normalizeError(err: unknown): NormalizedError {
  if (err instanceof AppError) {
    const base: NormalizedError = {
      code: err.code,
      status: err.status,
      publicMessage: err.message,
      logMessage: `${err.code}: ${err.message}`,
    };

    // With exactOptionalPropertyTypes, omit optional props instead of setting undefined.
    return err.details ? { ...base, details: err.details } : base;
  }


  // Native Error
  if (err instanceof Error) {
    return {
      code: "INTERNAL_ERROR",
      status: 500,
      publicMessage: "Unexpected error",
      logMessage: err.message,
      details: {
        name: err.name,
        // Do NOT include stack traces in client responses.
        // You may log stack traces in server logs if desired; keep it optional:
        stack: err.stack,
      },
    };
  }

  // Non-Error throw (string, object, etc.)
  return {
    code: "INTERNAL_ERROR",
    status: 500,
    publicMessage: "Unexpected error",
    logMessage: `Non-error thrown: ${String(err)}`,
  };
}
