// src/modules/identity/infrastructure/repository.memory.ts
/**
 * In-memory IdentityRepository.
 *
 * Why:
 * - Tests/CI must not require DATABASE_URL.
 * - Local dev can still boot without DB if desired.
 *
 * Production rule:
 * - This must never be used in production deployments.
 */

import { randomUUID } from "node:crypto";
import type { IdentityRepository, CreateSessionInput } from "./repository.js";
import type { IdentityUser } from "../domain/identity.js";
import { hashPassword } from "../../../shared/security/password.js";

type SessionRow = Readonly<{
  id: string;
  userId: string;
  surface: "client" | "admin";
  expiresAtMs: number;
  revokedAtMs?: number;
}>;

function nowMs(): number {
  return Date.now();
}

export class MemoryIdentityRepository implements IdentityRepository {
  private readonly usersByEmail = new Map<string, IdentityUser>();
  private readonly sessionsById = new Map<string, SessionRow>();

  /**
   * Seed users for local/dev tests if desired.
   * This keeps the repository deterministic.
   */
  public static async createDefaultSeed(): Promise<MemoryIdentityRepository> {
    const r = new MemoryIdentityRepository();

    // ✅ Deterministic seed accounts (v1)
    // You can remove these once DB is always configured in all environments.
    const adminPass = await hashPassword("admin_password");
    const clientPass = await hashPassword("client_password");

    r.usersByEmail.set("admin@balance.local", {
      id: "00000000-0000-0000-0000-000000000001",
      email: "admin@balance.local",
      status: "active",
      role: "admin",
      passwordHash: adminPass,
    });

    r.usersByEmail.set("client@balance.local", {
      id: "00000000-0000-0000-0000-000000000002",
      email: "client@balance.local",
      status: "active",
      role: "client",
      passwordHash: clientPass,
    });

    return r;
  }

  async findUserForLoginByEmail(emailLower: string): Promise<IdentityUser | null> {
    return this.usersByEmail.get(emailLower) ?? null;
  }

  async createSession(input: CreateSessionInput): Promise<string> {
    const id = randomUUID();

    // v1 defaults: 14 days.
    const expiresAtMs = nowMs() + 14 * 24 * 60 * 60 * 1000;

    this.sessionsById.set(id, {
      id,
      userId: input.userId,
      surface: input.surface,
      expiresAtMs,
    });

    return id;
  }

  async resolveSession(sessionId: string, expectedSurface: "client" | "admin"): Promise<IdentityUser | null> {
    const s = this.sessionsById.get(sessionId);
    if (!s) return null;
    if (s.surface !== expectedSurface) return null;
    if (s.revokedAtMs !== undefined) return null;
    if (s.expiresAtMs <= nowMs()) return null;

    // Find user by id
    for (const u of this.usersByEmail.values()) {
      if (u.id === s.userId) return u;
    }
    return null;
  }

  async revokeSession(sessionId: string, _reason: string): Promise<void> {
    const s = this.sessionsById.get(sessionId);
    if (!s) return;

    // exactOptionalPropertyTypes-safe: create new object only if we need revokedAtMs
    if (s.revokedAtMs !== undefined) return;

    this.sessionsById.set(sessionId, { ...s, revokedAtMs: nowMs() });
  }
}
