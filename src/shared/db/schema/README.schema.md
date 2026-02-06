# DB Schema Layout (Locked)

This folder contains Drizzle schema definitions.

## Rules (Locked)

1) `core.ts` is **infra-only**.
   - It must not contain module tables.
   - `bk_env_marker` is defined here but is **not migrated** by Drizzle.

2) Identity tables live in `identity.ts`.
   - `users`, `accounts`, `roles`, `account_memberships`, `sessions`.

3) Module tables live in their own files:
   - `enquiry.ts`, `preferences.ts`, and later: `billing.ts`, `subscriptions.ts`.

4) `index.ts` is the **only** entrypoint used by DrizzleKit.
   - If a schema file is added/removed, update `index.ts` in the same PR.

## Migrations

Some constraints are intentionally implemented via SQL migrations:

- Partial unique indexes (e.g. account_memberships uniqueness where deleted_at is null)
- Partial uniqueness for customer_preferences active record
- Any advanced CHECK constraints not expressed in Drizzle DSL
