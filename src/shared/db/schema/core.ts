// src/shared/db/schema/core.ts
/**
 * Core DB tables (infra-only).
 *
 * Source of truth:
 * - balance_kitchen_schema.md
 *
 * Policy:
 * - This file contains ONLY cross-cutting infra tables.
 * - Domain/module tables (identity, enquiry, billing, subscriptions, etc.)
 *   MUST live in their own schema files.
 */

import { pgTable, text, timestamp, integer, customType } from "drizzle-orm/pg-core";

/**
 * inet type (Postgres)
 * Drizzle doesn't always expose inet directly depending on version.
 * This custom type keeps your schema aligned and your TS stable.
 */
export const inet = customType<{ data: string; notNull: false; default: false }>({
  dataType() {
    return "inet";
  },
});

/**
 * bk_env_marker
 *
 * Purpose:
 * - A single-row operational guardrail that marks the DB environment ("development" | "test" | "production").
 *
 * IMPORTANT:
 * - Per your schema/index.ts policy: this table is EXCLUDED from Drizzle migrations
 *   and created by db-bootstrap-env-marker.ts before safety checks/migrations run.
 */
export const bkEnvMarker = pgTable("bk_env_marker", {
  id: integer("id").primaryKey().default(1),
  env: text("env").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
