// src/modules/identity/infrastructure/repository.db.ts
/**
 * DB-backed IdentityRepository (Drizzle).
 *
 * Aligned to src/shared/db/schema/core.ts + balance_kitchen_schema.md
 *
 * Key choices:
 * - users table stores password_hash (Argon2 PHC string)
 * - roles/permissions come from account_memberships.role_key (until RBAC matures)
 * - sessions table stores opaque session id in sessions.id (cookie value)
 *
 * IMPORTANT:
 * - Must not connect at import-time.
 */

import type { IdentityRepository, CreateSessionInput, SessionRevokeReason } from "./repository.js";
import type { IdentityUser, IdentityUserRole, IdentityUserStatus } from "../domain/identity.js";
import { createDb } from "../../../shared/db/client.js";
import { users, accountMemberships } from "../../../shared/db/schema/identity.js";
import { sessions } from "../../../shared/db/schema/sessions.js";
import { and, eq, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

function mapStatus(db: string): IdentityUserStatus {
  // Schema doc: ACTIVE | SUSPENDED | DELETED
  switch (db) {
    case "ACTIVE":
      return "active";
    case "SUSPENDED":
    case "DELETED":
      return "inactive";
    default:
      // Fail closed (unknown values => inactive)
      return "inactive";
  }
}

/**
 * Derive role from account_memberships.
 * - If ANY active membership is admin/super_admin => "admin"
 * - Else => "client"
 *
 * NOTE:
 * - This keeps v1 simple.
 * - Later, replace with a proper RBAC/permissions model.
 */
async function deriveRoleForUserId(
  h: ReturnType<typeof createDb>,
  userId: string
): Promise<IdentityUserRole> {
  const rows = await h.db
    .select({ roleKey: accountMemberships.roleKey })
    .from(accountMemberships)
    .where(and(eq(accountMemberships.userId, userId), isNull(accountMemberships.deletedAt)))
    .limit(50);

  const hasAdmin = rows.some((r) => r.roleKey === "admin" || r.roleKey === "super_admin");
  return hasAdmin ? "admin" : "client";
}

export class DbIdentityRepository implements IdentityRepository {
  async findUserForLoginByEmail(emailLower: string): Promise<IdentityUser | null> {
    const h = createDb();
    try {
      const row = await h.db
        .select({
          id: users.id,
          email: users.email,
          status: users.status,
          passwordHash: users.passwordHash,
        })
        .from(users)
        // schema doc: unique index on lower(email)
        .where(and(sql`lower(${users.email}) = ${emailLower}`, isNull(users.deletedAt)))
        .limit(1);

      const u = row[0];
      if (!u) return null;

      const role = await deriveRoleForUserId(h, u.id);

      return {
        id: u.id,
        email: u.email,
        status: mapStatus(u.status),
        role,
        passwordHash: u.passwordHash ?? null,
      };
    } finally {
      await h.close();
    }
  }

  async createSession(input: CreateSessionInput): Promise<string> {
    const h = createDb();
    try {
      const sessionId = randomUUID();
      const now = new Date();

      // v1: 14 days absolute expiry
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      await h.db.insert(sessions).values({
        id: sessionId,
        userId: input.userId,
        surface: input.surface,
        authLevel: "AAL1",
        sessionFamilyId: randomUUID(),
        rotationCounter: 0,
        createdAt: now,
        lastSeenAt: now,
        expiresAt,
        revokedAt: null,
        revokeReason: null,
        userAgentSnapshot: input.userAgent ?? null,
        deviceIdHash: null,
        ipCreated: input.ip ?? null,
      });

      return sessionId;
    } finally {
      await h.close();
    }
  }

  async resolveSession(sessionId: string, expectedSurface: "client" | "admin"): Promise<IdentityUser | null> {
    const h = createDb();
    try {
      const s = await h.db
        .select({
          userId: sessions.userId,
          surface: sessions.surface,
          revokedAt: sessions.revokedAt,
          expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .where(and(eq(sessions.id, sessionId), eq(sessions.surface, expectedSurface)))
        .limit(1);

      const sess = s[0];
      if (!sess) return null;
      if (sess.revokedAt !== null) return null;
      if (sess.expiresAt.getTime() <= Date.now()) return null;

      const u = await h.db
        .select({
          id: users.id,
          email: users.email,
          status: users.status,
          passwordHash: users.passwordHash,
        })
        .from(users)
        .where(and(eq(users.id, sess.userId), isNull(users.deletedAt)))
        .limit(1);

      const user = u[0];
      if (!user) return null;

      const role = await deriveRoleForUserId(h, user.id);

      return {
        id: user.id,
        email: user.email,
        status: mapStatus(user.status),
        role,
        passwordHash: user.passwordHash ?? null,
      };
    } finally {
      await h.close();
    }
  }

  /**
 * Revoke a session (idempotent).
 *
 * Why defensive:
 * - If migrations drift (e.g. revoke_reason column missing in a test DB),
 *   logout must not 500 when we can still revoke safely.
 *
 * Strategy:
 * 1) Best-effort update revoked_at + revoke_reason
 * 2) If DB rejects due to missing column, retry with revoked_at only
 * 3) Never throw just because the session is already revoked (0 rows updated is ok)
 */
  async revokeSession(sessionId: string, reason: SessionRevokeReason): Promise<void> {
    const h = createDb();
    try {
      const now = new Date();

      // Attempt 1: revoke + reason (best-case schema)
      try {
        await h.db
          .update(sessions)
          .set({
            revokedAt: now,
            revokeReason: reason,
          })
          .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
        return;
      } catch (err1) {
        const msg1 = err1 instanceof Error ? err1.message : String(err1);

        // Attempt 2: revoke only (if revoke_reason column missing OR any update-shape issue)
        try {
          await h.db
            .update(sessions)
            .set({
              revokedAt: now,
            })
            .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
          return;
        } catch (err2) {
          const msg2 = err2 instanceof Error ? err2.message : String(err2);

          // Attempt 3: hard invalidate by deleting the session row.
          // This is the most compatible + guarantees logout invalidates the session.
          try {
            await h.db.delete(sessions).where(eq(sessions.id, sessionId));
            return;
          } catch (err3) {
            // If all 3 attempts fail, surface a useful combined error for logs.
            const msg3 = err3 instanceof Error ? err3.message : String(err3);
            throw new Error(
              [
                "Failed to revoke session via update+reason, update-only, and delete fallback.",
                `update+reason error: ${msg1}`,
                `update-only error: ${msg2}`,
                `delete error: ${msg3}`,
              ].join("\n"),
            );
          }
        }
      }
    } finally {
      await h.close();
    }
  }
}

/**
 * Preferred constructor for routes/usecases.
 * IMPORTANT: does NOT connect at import-time.
 */
export function createDbIdentityRepository(): IdentityRepository {
  return new DbIdentityRepository();
}
