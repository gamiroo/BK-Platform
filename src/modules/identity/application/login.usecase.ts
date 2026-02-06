// src/modules/identity/application/login.usecase.ts
/**
 * Login use-case (transport-agnostic).
 *
 * Input:
 * - email, password
 * - expectedRole ("client" | "admin") to prevent cross-surface escalation
 * - userAgent/ip are captured for session binding + auditing (later improvements)
 *
 * Output:
 * - actor (safe identity summary)
 * - sessionId (opaque)
 *
 * Security posture:
 * - Collapse all failures to AuthInvalidError (prevents account enumeration).
 * - Deny by default.
 * - Do not set cookies here (transport concern).
 *
 * IMPORTANT CONTRACT:
 * - `verifyPassword(storedHash, password)` (stored hash first)
 */

import { AuthInvalidError } from "../domain/errors.js";
import type { AuthActor, IdentityUserRole } from "../domain/identity.js";
import type { IdentityRepository } from "../infrastructure/repository.js";
import { verifyPassword } from "../../../shared/security/password.js";

export type LoginInput = Readonly<{
  email: string;
  password: string;
  expectedRole: IdentityUserRole;
  userAgent: string | null;
  ip: string | null;
}>;

export type LoginOutput = Readonly<{
  actor: AuthActor;
  sessionId: string;
}>;

export async function loginUseCase(
  repo: IdentityRepository,
  input: LoginInput
): Promise<LoginOutput> {
  const emailLower = input.email.trim().toLowerCase();

  // ✅ Fail closed: anything unexpected becomes AuthInvalidError
  const user = await repo.findUserForLoginByEmail(emailLower);
  if (!user) throw new AuthInvalidError();

  // Status gating (future: "invited" / "suspended" / etc)
  if (user.status !== "active") throw new AuthInvalidError();

  // Role gating: prevent client creds on admin surface, etc.
  if (user.role !== input.expectedRole) throw new AuthInvalidError();

  // Password gating
  if (!user.passwordHash) throw new AuthInvalidError();

  /**
   * ✅ CRITICAL FIX:
   * verifyPassword signature is:
   *   verifyPassword(storedHash, password)
   *
   * If reversed, argon2.verify() will treat the plaintext password as a PHC hash,
   * and verification will always fail → login always 401 → /me tests fail.
   */
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) throw new AuthInvalidError();

  /**
   * Create session.
   *
   * For v1 the "surface" aligns to role.
   * Later: you may want to distinguish surface ("admin"|"client") from role
   * if you introduce staff roles or client admins, etc.
   */
  const sessionId = await repo.createSession({
    userId: user.id,
    surface: input.expectedRole,
    userAgent: input.userAgent,
    ip: input.ip,
  });

  // Return a safe, minimal actor shape.
  const actor: AuthActor =
    user.role === "admin"
      ? { kind: "admin", role: "admin", user_id: user.id }
      : { kind: "client", role: "client", user_id: user.id };

  return { actor, sessionId };
}
