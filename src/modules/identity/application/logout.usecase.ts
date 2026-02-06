// src/modules/identity/application/logout.usecase.ts
/**
 * Logout use-case (transport-agnostic).
 *
 * Properties:
 * - Idempotent
 * - If sessionId missing: do nothing
 * - If sessionId unknown/revoked: do nothing (still success)
 */

import type { IdentityRepository, SessionRevokeReason } from "../infrastructure/repository.js";

export async function logoutUseCase(
  repo: IdentityRepository,
  sessionId: string | null,
  reason: SessionRevokeReason = "logout",
): Promise<void> {
  if (!sessionId) return;
  await repo.revokeSession(sessionId, reason);
}
