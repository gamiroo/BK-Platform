// src/shared/logging/logger.ts
/**
 * Central structured logger for BK (Pino).
 *
 * Goals:
 * - JSON logs (machine readable) suitable for Vercel + log drains.
 * - Redaction to avoid leaking secrets/PII.
 * - Stable field names (request_id is always the correlation key).
 *
 * Notes:
 * - With `exactOptionalPropertyTypes`, avoid assigning `undefined` to optional config props.
 * - Pino's `base` is typed as object | null. Use `null` to disable pid/hostname binding.
 */

import pino, { type LoggerOptions } from "pino";

const isProd = process.env.NODE_ENV === "production";

// Keep log level configurable, defaulting to more verbose locally.
const level =
  process.env.LOG_LEVEL ??
  (isProd ? "info" : "debug");

// Redaction patterns:
// - These apply to any log object you pass to logger.*()
// - Keep conservative by default; you can refine when field names stabilize.
const redact: LoggerOptions["redact"] = {
  paths: [
    // Common header locations (we frequently log req/res metadata)
    "req.headers.authorization",
    "req.headers.cookie",
    "req.headers['set-cookie']",
    "res.headers['set-cookie']",

    // Generic secret-ish keys (catch-all)
    "*.password",
    "*.token",
    "*.secret",
    "*.apiKey",
    "*.apikey",
    "*.authorization",
    "*.cookie",

    // Stripe / billing
    "*.stripeSignature",
    "*.webhookSecret",
  ],
  censor: "[REDACTED]",
};

export const logger = pino({
  level,
  base: null,
  redact,

  // Timestamp format: epoch millis (works well for log pipelines)
  timestamp: pino.stdTimeFunctions.epochTime,
});
