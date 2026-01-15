// src/shared/logging/logger.ts
// Central Pino logger.
// - Use structured logging everywhere.
// - `exactOptionalPropertyTypes` means optional props can't be set to `undefined`
//   unless the type explicitly includes `undefined`.
// - Pino's `base` is typed as object | null, so use `null` (or omit it).

import pino from "pino";

const isProd = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),

  // ✅ Important: With exactOptionalPropertyTypes, `base: undefined` is invalid.
  // `null` tells Pino: "do not include pid/hostname bindings automatically".
  base: null,

  // Redact sensitive fields anywhere they appear in log objects.
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "*.password",
      "*.token",
      "*.secret",
    ],
    censor: "[REDACTED]",
  },
});
