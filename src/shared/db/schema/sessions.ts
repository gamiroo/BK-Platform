// src/shared/db/schema/sessions.ts
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  index,
  customType,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "./identity";

/**
 * inet type (Postgres)
 * Drizzle doesn't always expose inet directly depending on version.
 */
const inet = customType<{ data: string; notNull: false; default: false }>({
  dataType() {
    return "inet";
  },
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(), // session_id

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),

    // client | admin
    surface: text("surface").notNull(),

    // AAL1 | AAL2 | AAL3
    authLevel: text("auth_level").notNull().default("AAL1"),

    sessionFamilyId: uuid("session_family_id").notNull(),
    rotationCounter: integer("rotation_counter").notNull().default(0),

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
    sessionsUserSurfaceRevokedIdx: index("sessions_user_surface_revoked_idx").on(
      t.userId,
      t.surface,
      t.revokedAt,
    ),
    sessionsExpiresIdx: index("sessions_expires_at_idx").on(t.expiresAt),

    // Optional checks (safe, schema-aligned). Keep or remove depending on how strict you want drizzle-generated DDL.
    surfaceCheck: check("sessions_surface_check", sql`${t.surface} in ('client','admin')`),
    authLevelCheck: check("sessions_auth_level_check", sql`${t.authLevel} in ('AAL1','AAL2','AAL3')`),
    rotationCounterCheck: check("sessions_rotation_counter_check", sql`${t.rotationCounter} >= 0`),
    revokedAtCheck: check("sessions_revoked_at_check", sql`${t.revokedAt} is null or ${t.revokedAt} <= now()`),
  }),
);
