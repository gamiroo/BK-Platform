// src/shared/errors/error-codes.ts
/**
 * Canonical error codes for BK.
 *
 * Rules:
 * - Codes are stable, uppercase, underscore-separated.
 * - Do not expose internal stack traces to clients.
 * - Codes should be used for client behavior + analytics, not for debugging stack traces.
 *
 * Expand this list as modules land.
 */

export type ErrorCode =
  // Generic
  | "INTERNAL_ERROR"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "RATE_LIMITED"

  // Validation
  | "VALIDATION_FAILED"

  // Security / BalanceGuard
  | "ORIGIN_REJECTED"
  | "CSRF_REQUIRED"
  | "CSRF_INVALID"
  | "SESSION_INVALID"
  | "SESSION_EXPIRED"
  | "AUTH_REQUIRED"
  | "AUTHZ_DENIED";
