// src/shared/logging/security-logger.ts
// A dedicated logger helper for security events.
// - Always include request_id when available.
// - Use consistent event names later (e.g. BG_* codes).

import { logger } from "./logger.js";
import { getRequestContext } from "./request-context.js";

export const securityLogger = {
  info(event: string, meta: Record<string, unknown> = {}) {
    const ctx = getRequestContext();
    logger.info({ event, request_id: ctx?.request_id, ...meta }, event);
  },

  warn(event: string, meta: Record<string, unknown> = {}) {
    const ctx = getRequestContext();
    logger.warn({ event, request_id: ctx?.request_id, ...meta }, event);
  },

  error(event: string, meta: Record<string, unknown> = {}) {
    const ctx = getRequestContext();
    logger.error({ event, request_id: ctx?.request_id, ...meta }, event);
  },
};
