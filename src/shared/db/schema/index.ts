// src/shared/db/schema/index.ts
/**
 * Canonical Drizzle schema entrypoint for DrizzleKit.
 *
 * IMPORTANT:
 * - DrizzleKit loads this file directly from TS.
 * - Do NOT use ".js" extension imports here.
 *
 * Policy:
 * - We EXCLUDE bk_env_marker from Drizzle migrations because it is created
 *   by db-bootstrap-env-marker.ts before safety checks/migrations run.
 */

// Identity / Access
export { users, accounts, roles, accountMemberships } from "./identity";

// Sessions
export { sessions } from "./sessions";

// Enquiry
export { enquiries } from "./enquiry";

// Preferences
export { customerPreferences } from "./customer-preferences";

// Billing
export {
  billingCustomers,
  billingEvents,
  billingTransactions,
  billingLineItems,
  billingRefunds,
} from "./billing";

// Subscriptions
export {
  subscriptionPlans,
  subscriptions,
  subscriptionEntitlements,
  subscriptionEvents,
} from "./subscriptions";
