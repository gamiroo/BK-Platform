// src/shared/config/env.ts
/**
 * BK env loader (framework-free).
 * Route all environment access through this module.
 *
 * Notes:
 * - With strict TS + exactOptionalPropertyTypes, we keep parsing explicit.
 * - You can extend this type as you add infrastructure (DB, Stripe, etc).
 */

export type Env = Readonly<{
  NODE_ENV: "development" | "test" | "production";
  PORT: number;

  // Add later (uncomment when ready):
  // DATABASE_URL: string;
  // STRIPE_SECRET_KEY: string;
  // STRIPE_WEBHOOK_SECRET_BILLING: string;
  // LOG_LEVEL?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
}>;

/**
 * Read a required environment variable (throws if missing).
 * Exported so all code uses a single consistent access pattern.
 */
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

/**
 * Read an optional environment variable (returns undefined if missing).
 */
export function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v ? v : undefined;
}

export function loadEnv(): Env {
  const nodeEnv = (process.env.NODE_ENV ?? "development") as Env["NODE_ENV"];

  const portRaw = process.env.PORT ?? "3000";
  const port = Number(portRaw);
  if (!Number.isFinite(port)) throw new Error("PORT must be a number");

  // When you’re ready, enforce required vars here:
  // const DATABASE_URL = requireEnv("DATABASE_URL");

  return { NODE_ENV: nodeEnv, PORT: port };
}
