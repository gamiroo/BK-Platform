// scripts/confirm-prod-migrate.mjs
/**
 * Production migration safety guard (hard lock).
 *
 * Refuses to proceed unless ALL are true:
 * - CONFIRM_PROD_MIGRATE=YES
 * - DATABASE_URL is set
 * - NODE_ENV=production
 * - If VERCEL_ENV is present, it MUST be "production"
 * - DB env marker safety check passes (expects "prod")
 *
 * To run:
 *   CONFIRM_PROD_MIGRATE=YES NODE_ENV=production DATABASE_URL=... pnpm db:migrate:prod
 */

import { spawnSync } from "node:child_process";

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

if (process.env.NODE_ENV !== "production") {
  console.error(
    `❌ NODE_ENV must be "production" for prod migrations (got "${process.env.NODE_ENV ?? "undefined"}").`
  );
  process.exit(1);
}

const vercelEnv = process.env.VERCEL_ENV;
if (vercelEnv !== undefined && vercelEnv !== "production") {
  console.error(
    `❌ VERCEL_ENV must be "production" for prod migrations when present (got "${vercelEnv}").`
  );
  process.exit(1);
}

// Run DB env-marker safety check (expects prod marker).
// IMPORTANT: db:safety:prod must NOT call confirm-prod-migrate (avoid recursion).
const nodeBin = process.platform === "win32" ? "node.exe" : "node";
const r = spawnSync(nodeBin, ["--import", "tsx", "scripts/db-safety-check.ts"], { stdio: "inherit" });

if (r.status !== 0) {
  console.error("❌ DB safety check failed. Refusing to run production migrations.");
  process.exit(1);
}

console.log("✅ Production migration hard-lock passed.");
