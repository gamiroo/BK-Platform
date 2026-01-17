// src/shared/errors/app-error.ts
/**
 * AppError is the canonical typed error used across domain/application layers.
 *
 * Design:
 * - Carries a stable `code` (for clients and logging).
 * - Carries an HTTP `status` (how we respond).
 * - Can include `details` (safe-to-log, not always safe-to-return).
 *
 * Rule of thumb:
 * - Throw AppError for "expected" errors (validation, forbidden, not found).
 * - Throw unknown Errors for unexpected bugs; those normalize to INTERNAL_ERROR.
 */

import type { ErrorCode } from "./error-codes.js";

export type AppErrorPublic = Readonly<{
  code: ErrorCode;
  message: string;
}>;

export type AppErrorDetails = Readonly<Record<string, unknown>>;

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;

  /**
   * Safe details for logs (and sometimes for clients depending on code).
   * Keep this free of secrets/PII.
   */
  public readonly details?: AppErrorDetails;

   constructor(opts: {
    code: ErrorCode;
    status: number;
    message: string;
    details?: AppErrorDetails;
    cause?: unknown;
  }) {
    super(opts.message);
    this.name = "AppError";
    this.code = opts.code;
    this.status = opts.status;

    // With exactOptionalPropertyTypes:
    // - optional props must be omitted rather than assigned `undefined`.
    if (opts.details !== undefined) {
      this.details = opts.details;
    }

    // Error.cause exists in modern JS runtimes (Node 16.9+, widely supported now).
    // TypeScript's lib typing may not always reflect runtime, depending on tsconfig libs.
    // Avoid `any` by assigning via a structural type.
    if (opts.cause !== undefined) {
      (this as unknown as { cause: unknown }).cause = opts.cause;
    }
  }

}
