// src/modules/identity/infrastructure/repository.ts
/**
 * IdentityRepository boundary.
 *
 * IMPORTANT:
 * - Application/use-cases depend on this interface, not on Drizzle.
 * - Repositories must map persistence types -> domain types.
 */

import type { IdentityUser } from "../domain/identity.js";

export type CreateSessionInput = Readonly<{
  userId: string;
  surface: "client" | "admin";
  userAgent: string | null;
  ip: string | null;
}>;

/**
 * Why a union instead of string:
 * - Prevents drift (random strings in DB)
 * - Keeps logs/analytics stable
 * - Makes tests + call sites self-documenting
 */
export type SessionRevokeReason = "logout" | "security";

export interface IdentityRepository {
  findUserForLoginByEmail(emailLower: string): Promise<IdentityUser | null>;

  /**
   * Create a server-side session and return its opaque ID.
   */
  createSession(input: CreateSessionInput): Promise<string>;

  /**
   * Resolve a session back to a user, if valid.
   * Returns null when missing/expired/revoked.
   */
  resolveSession(
    sessionId: string,
    expectedSurface: "client" | "admin"
  ): Promise<IdentityUser | null>;

  /**
   * Revoke a session (idempotent).
   *
   * Contract:
   * - If the session does not exist: do nothing (still success)
   * - If already revoked: do nothing (still success)
   * - Must not throw for "0 rows updated"
   */
  revokeSession(sessionId: string, reason: SessionRevokeReason): Promise<void>;
}
