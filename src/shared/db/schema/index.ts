// src/shared/db/schema/index.ts
/**
 * Canonical Drizzle schema entrypoint.
 */

import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const bkEnvMarker = pgTable("bk_env_marker", {
  id: integer("id").primaryKey().default(1),
  env: text("env").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    usersEmailUq: uniqueIndex("users_email_uq").on(t.email),
    usersCreatedAtIdx: index("users_created_at_idx").on(t.createdAt),
  })
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    surface: text("surface").notNull(),
    userId: uuid("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    ipHash: text("ip_hash"),
    uaHash: text("ua_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => ({
    sessionsTokenHashUq: uniqueIndex("sessions_token_hash_uq").on(t.tokenHash),
    sessionsUserIdx: index("sessions_user_id_idx").on(t.userId),
    sessionsSurfaceIdx: index("sessions_surface_idx").on(t.surface),
    sessionsExpiresIdx: index("sessions_expires_at_idx").on(t.expiresAt),
  })
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: text("request_id"),
    surface: text("surface").notNull(),
    actorType: text("actor_type").notNull().default("anon"),
    actorId: text("actor_id"),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    auditLogEventTypeIdx: index("audit_log_event_type_idx").on(t.eventType),
    auditLogCreatedAtIdx: index("audit_log_created_at_idx").on(t.createdAt),
  })
);

export const enquiries = pgTable(
  "enquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    name: text("name").notNull(),
    email: text("email").notNull(),
    message: text("message").notNull(),

    // Zoho sync tracking
    zohoLeadId: text("zoho_lead_id"),
    zohoSyncStatus: text("zoho_sync_status").notNull().default("pending"), // pending | ok | failed
    zohoLastError: text("zoho_last_error"),
    zohoSyncedAt: timestamp("zoho_synced_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    enquiriesCreatedAtIdx: index("enquiries_created_at_idx").on(t.createdAt),
    enquiriesEmailIdx: index("enquiries_email_idx").on(t.email),
    enquiriesZohoStatusIdx: index("enquiries_zoho_status_idx").on(t.zohoSyncStatus),
  })
);
