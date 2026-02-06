// src/modules/identity/domain/errors.ts
/**
 * Identity domain errors.
 *
 * Security rule:
 * - Never leak “email not found” vs “wrong password”.
 * - Collapse all auth failures to AuthInvalidError.
 */

export class AuthInvalidError extends Error {
  public readonly name = "AuthInvalidError";

  constructor() {
    super("Invalid credentials.");
  }
}
