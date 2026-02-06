// src/shared/db/schema/customer-preferences.ts
import { pgTable, uuid, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";

import { accounts } from "./identity";

export const customerPreferences = pgTable(
  "customer_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),

    requestId: uuid("request_id").notNull(),

    version: integer("version").notNull().default(1),
    preferencesJson: jsonb("preferences_json").notNull(),

    // Apply changes next renewal / next period
    effectiveFromPeriodStart: timestamp("effective_from_period_start", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    customerPreferencesAccountIdx: index("customer_preferences_account_id_idx").on(t.accountId),

    // NOTE:
    // Schema wants: unique(account_id) where deleted_at is null
    // Implement as a partial unique index in a SQL migration (recommended).
  }),
);
