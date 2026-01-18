// src/shared/db/schema/index.ts
/**
 * Canonical Drizzle schema entrypoint.
 *
 * This file is the single source-of-truth for Postgres schema definitions.
 *
 * Rules:
 * - All new tables/enums live under `src/shared/db/schema/*` and are exported here.
 * - Migrations are generated from this schema into `drizzle/`.
 * - The DB is part of the trust boundary: use constraints and types to enforce invariants.
 */

import { pgTable, text, timestamp, uuid, jsonb, integer, index } from "drizzle-orm/pg-core";

/**
 * Environment marker table (operational).
 *
 * Purpose:
 * - Provides a deterministic way to prove "this DATABASE_URL points at DEV" vs "PROD".
 *
 * One row only (id = 1).
 * Values:
 * - env = "dev" | "prod"
 */
export const bkEnvMarker = pgTable("bk_env_marker", {
  id: integer("id").primaryKey().default(1),
  env: text("env").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Audit log skeleton (future-ready).
 *
 * Purpose:
 * - Central, append-only audit stream for security and operational events.
 * - Designed to align with BalanceGuard logging + future compliance needs.
 *
 * Notes:
 * - Keep payload flexible using JSONB (redacted upstream as needed).
 * - Avoid storing secrets; store references/ids only.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Correlates to RequestContext.request_id where applicable.
    requestId: text("request_id"),

    // Surface where the event occurred: "site" | "client" | "admin" (future-enforced enum)
    surface: text("surface").notNull(),

    // Actor identity (future): anon/user/admin/system identifiers
    actorType: text("actor_type").notNull().default("anon"),
    actorId: text("actor_id"),

    // Event taxonomy (future): e.g. "AUTH_LOGIN", "ORDER_SUBMIT", "CSRF_REJECTED"
    eventType: text("event_type").notNull(),

    // Additional metadata (must be redacted upstream)
    payload: jsonb("payload").notNull().default({}),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    auditLogEventTypeIdx: index("audit_log_event_type_idx").on(t.eventType),
    auditLogCreatedAtIdx: index("audit_log_created_at_idx").on(t.createdAt),
  })
);
