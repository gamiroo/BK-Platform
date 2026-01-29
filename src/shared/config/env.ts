// src/shared/config/env.ts
/**
 * BK env loader (framework-free).
 * Route all environment access through this module.
 *
 * Canonical rules:
 * - Do not read process.env anywhere else (except tooling scripts).
 * - Required vars throw on access (fail fast).
 * - Optional vars are omitted when missing (exactOptionalPropertyTypes-safe).
 */

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";

export type Env = Readonly<{
  NODE_ENV: "development" | "test" | "production";
  PORT: number;

  // Postgres/Drizzle
  DATABASE_URL: string;

  // Redis (rate limiting)
  REDIS_URL?: string;

  // Observability
  LOG_LEVEL?: LogLevel;

  /**
   * Vercel sets this at runtime.
   * - "production" | "preview" | "development"
   *
   * Keep optional so local dev doesn't require it.
   */
  VERCEL_ENV?: "production" | "preview" | "development";
}>;

/**
 * Runtime-only env subset that does NOT require DB configuration.
 * Used by infra wiring that must work in tests without DATABASE_URL.
 */
export type RuntimeEnv = Readonly<{
  NODE_ENV: Env["NODE_ENV"];
  REDIS_URL?: string;
  LOG_LEVEL?: LogLevel;
  VERCEL_ENV?: NonNullable<Env["VERCEL_ENV"]>;

  // ✅ add these
  BK_ORIGINS_SITE?: string;
  BK_ORIGINS_CLIENT?: string;
  BK_ORIGINS_ADMIN?: string;

  // (optional: you can delete CORS_* later once migrated everywhere)
  CORS_SITE_ORIGINS?: string;
  CORS_CLIENT_ORIGINS?: string;
  CORS_ADMIN_ORIGINS?: string;
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

function parseNodeEnv(raw: string | undefined): Env["NODE_ENV"] {
  const v = (raw ?? "development") as Env["NODE_ENV"];
  if (v !== "development" && v !== "test" && v !== "production") {
    throw new Error("NODE_ENV must be one of: development | test | production");
  }
  return v;
}

function parsePort(raw: string | undefined): number {
  const portRaw = raw ?? "3000";
  const port = Number(portRaw);
  if (!Number.isFinite(port)) throw new Error("PORT must be a number");
  return port;
}

function parseLogLevel(raw: string | undefined): Env["LOG_LEVEL"] {
  if (!raw) return undefined;
  const v = raw as LogLevel;
  switch (v) {
    case "fatal":
    case "error":
    case "warn":
    case "info":
    case "debug":
    case "trace":
    case "silent":
      return v;
    default:
      throw new Error("LOG_LEVEL must be a valid pino level");
  }
}

function parseVercelEnv(raw: string | undefined): Env["VERCEL_ENV"] {
  if (!raw) return undefined;
  const v = raw as Env["VERCEL_ENV"];
  if (v !== "production" && v !== "preview" && v !== "development") {
    throw new Error("VERCEL_ENV must be one of: production | preview | development");
  }
  return v;
}

function parseRedisUrl(raw: string | undefined): Env["REDIS_URL"] {
  if (!raw) return undefined;
  if (!raw.includes("://")) {
    throw new Error("REDIS_URL must be a valid URL (e.g. redis://... or rediss://...)");
  }
  return raw;
}

/**
 * Load runtime-only env (no DB requirement).
 * Safe to call in tests without DATABASE_URL.
 */
export function loadRuntimeEnv(): RuntimeEnv {
  const NODE_ENV = parseNodeEnv(process.env.NODE_ENV);
  const REDIS_URL = parseRedisUrl(optionalEnv("REDIS_URL"));
  const LOG_LEVEL = parseLogLevel(optionalEnv("LOG_LEVEL"));
  const VERCEL_ENV = parseVercelEnv(optionalEnv("VERCEL_ENV"));
  const BK_ORIGINS_SITE = optionalEnv("BK_ORIGINS_SITE");
  const BK_ORIGINS_CLIENT = optionalEnv("BK_ORIGINS_CLIENT");
  const BK_ORIGINS_ADMIN = optionalEnv("BK_ORIGINS_ADMIN");

  const out: {
    NODE_ENV: Env["NODE_ENV"];
    REDIS_URL?: string;
    LOG_LEVEL?: LogLevel;
    VERCEL_ENV?: NonNullable<Env["VERCEL_ENV"]>;

    BK_ORIGINS_SITE?: string;
    BK_ORIGINS_CLIENT?: string;
    BK_ORIGINS_ADMIN?: string;

    CORS_SITE_ORIGINS?: string;
    CORS_CLIENT_ORIGINS?: string;
    CORS_ADMIN_ORIGINS?: string;

  } = { NODE_ENV };

  if (REDIS_URL !== undefined) out.REDIS_URL = REDIS_URL;
  if (LOG_LEVEL !== undefined) out.LOG_LEVEL = LOG_LEVEL;
  if (VERCEL_ENV !== undefined) out.VERCEL_ENV = VERCEL_ENV;

  if (BK_ORIGINS_SITE !== undefined) out.BK_ORIGINS_SITE = BK_ORIGINS_SITE;
  if (BK_ORIGINS_CLIENT !== undefined) out.BK_ORIGINS_CLIENT = BK_ORIGINS_CLIENT;
  if (BK_ORIGINS_ADMIN !== undefined) out.BK_ORIGINS_ADMIN = BK_ORIGINS_ADMIN;

  return out;
}

export function loadEnv(): Env {
  const NODE_ENV = parseNodeEnv(process.env.NODE_ENV);
  const PORT = parsePort(process.env.PORT);

  // Required for any server runtime that touches DB
  const DATABASE_URL = requireEnv("DATABASE_URL");

  const REDIS_URL = parseRedisUrl(optionalEnv("REDIS_URL"));
  const LOG_LEVEL = parseLogLevel(optionalEnv("LOG_LEVEL"));
  const VERCEL_ENV = parseVercelEnv(optionalEnv("VERCEL_ENV"));
  

  // Build object without ever setting optional props to undefined.
  const out: {
    NODE_ENV: Env["NODE_ENV"];
    PORT: number;
    DATABASE_URL: string;
    REDIS_URL?: string;
    LOG_LEVEL?: LogLevel;
    VERCEL_ENV?: NonNullable<Env["VERCEL_ENV"]>;
  } = { NODE_ENV, PORT, DATABASE_URL };

  if (REDIS_URL !== undefined) out.REDIS_URL = REDIS_URL;
  if (LOG_LEVEL !== undefined) out.LOG_LEVEL = LOG_LEVEL;
  if (VERCEL_ENV !== undefined) out.VERCEL_ENV = VERCEL_ENV;

  return out;
}
