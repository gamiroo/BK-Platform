// src/shared/db/schema/enquiry.ts
/**
 * Enquiry module tables.
 */

import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";

export const enquiries = pgTable(
  "enquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull(),

    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    message: text("message").notNull(),

    // NEW | IN_PROGRESS | CONVERTED | CLOSED
    status: text("status").notNull(),

    assignedToUserId: uuid("assigned_to_user_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    enquiriesStatusIdx: index("enquiries_status_idx").on(t.status),
    enquiriesAssignedIdx: index("enquiries_assigned_to_user_id_idx").on(t.assignedToUserId),
  })
);
