// src/shared/db/schema/identity.ts
/**
 * Identity & Access Control tables.
 *
 * These tables are persisted identity state (users/accounts/roles/memberships/sessions).
 * BalanceGuard runtime logic lives elsewhere; this file is DB schema only.
 */

import {
  pgTable,
  text,
  timestamp,
  uuid,
  index,
  uniqueIndex,
  integer,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { inet } from "./core";

/**
 * users
 * Schema doc §2.1
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    email: text("email").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    displayName: text("display_name"),

    // Argon2 PHC string
    passwordHash: text("password_hash"),

    // ACTIVE | SUSPENDED | DELETED
    status: text("status").notNull().default("ACTIVE"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    usersEmailLowerUq: uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`),
    usersCreatedAtIdx: index("users_created_at_idx").on(t.createdAt),
  })
);

/**
 * accounts
 * Schema doc §2.2
 */
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // CUSTOMER | INTERNAL
    accountType: text("account_type").notNull(),
    // ACTIVE | PAUSED | SUSPENDED | CLOSED
    status: text("status").notNull(),

    primaryUserId: uuid("primary_user_id").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    accountsPrimaryUserIdx: index("accounts_primary_user_id_idx").on(t.primaryUserId),
  })
);

/**
 * roles
 * Schema doc §2.3
 */
export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(), // client | admin | account_manager | super_admin
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    rolesKeyUq: uniqueIndex("roles_key_uq").on(t.key),
  })
);

/**
 * account_memberships
 * Schema doc §2.4
 *
 * NOTE:
 * - Partial unique constraint (account_id,user_id,role_key) where deleted_at is null
 *   must be done via SQL migration (Drizzle can't express partial unique indexes in pg-core DSL cleanly).
 */
export const accountMemberships = pgTable(
  "account_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull(),
    userId: uuid("user_id").notNull(),

    roleKey: text("role_key").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    accountMembershipsUserIdx: index("account_memberships_user_id_idx").on(t.userId),
    accountMembershipsAccountIdx: index("account_memberships_account_id_idx").on(t.accountId),
  })
);

/**
 * sessions (BalanceGuard v3)
 * Schema doc §3.1 + REQUIRED support for token_hash lookup.
 *
 * IMPORTANT:
 * - BalanceGuard resolves sessions by hashing cookie token => token_hash.
 * - Therefore sessions MUST store token_hash.
 *
 * Add this now, before billing/subscriptions, to prevent auth drift.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: uuid("user_id").notNull(),

    // client | admin
    surface: text("surface").notNull(),

    // AAL1 | AAL2 | AAL3
    authLevel: text("auth_level").notNull().default("AAL1"),

    sessionFamilyId: uuid("session_family_id").notNull(),
    rotationCounter: integer("rotation_counter").notNull().default(0),

    /**
     * Opaque session token hash (sha256 hex).
     * Used to look up the session from the cookie.
     */
    tokenHash: text("token_hash").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokeReason: text("revoke_reason"),

    userAgentSnapshot: text("user_agent_snapshot"),
    deviceIdHash: text("device_id_hash"),
    ipCreated: inet("ip_created"),
  },
  (t) => ({
    sessionsTokenHashUq: uniqueIndex("sessions_token_hash_uq").on(t.tokenHash),
    sessionsUserSurfaceRevokedIdx: index("sessions_user_surface_revoked_idx").on(
      t.userId,
      t.surface,
      t.revokedAt
    ),
    sessionsExpiresIdx: index("sessions_expires_at_idx").on(t.expiresAt),
  })
);
