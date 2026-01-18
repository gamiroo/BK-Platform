// src/shared/logging/security-logger.ts
/**
 * Security-focused logger.
 *
 * Use this for:
 * - BalanceGuard decisions (origin/CSRF/rate-limit/authz)
 * - suspicious traffic signals
 * - authentication / session actions (login, logout, escalation)
 *
 * Convention:
 * - Prefer stable "BG_*" event names for BalanceGuard-level actions.
 * - Never log raw secrets. The base logger redacts common patterns, but don’t rely solely on it.
 */

import { logger } from "./logger.js";
import { getRequestContext } from "./request-context.js";

export type SecurityMeta = Record<string, unknown>;

function base(meta?: SecurityMeta): SecurityMeta {
  const ctx = getRequestContext();
  return {
    request_id: ctx?.request_id,
    surface: ctx?.surface,
    ip: ctx?.ip,
    ...meta,
  };
}

export const securityLogger = {
  info(event: string, meta?: SecurityMeta): void {
    logger.info({ event, ...base(meta) }, event);
  },
  warn(event: string, meta?: SecurityMeta): void {
    logger.warn({ event, ...base(meta) }, event);
  },
  error(event: string, meta?: SecurityMeta): void {
    logger.error({ event, ...base(meta) }, event);
  },
};
