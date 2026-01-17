// scripts/confirm-prod-migrate.mjs
/**
 * Production migration safety guard.
 *
 * This prevents accidental migrations against production from a dev machine.
 *
 * To run:
 *   CONFIRM_PROD_MIGRATE=YES DATABASE_URL=... pnpm db:migrate:prod
 */

const confirm = process.env.CONFIRM_PROD_MIGRATE;

if (confirm !== "YES") {
  console.error(
    "❌ Refusing to run production migrations.\n" +
      "Set CONFIRM_PROD_MIGRATE=YES to confirm you intend to migrate production."
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is missing. Refusing to run migrations.");
  process.exit(1);
}

console.log("✅ Production migration guard passed.");
