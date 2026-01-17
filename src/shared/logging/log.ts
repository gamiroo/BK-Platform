// src/shared/logging/log.ts
/**
 * Context-aware logging helpers.
 *
 * Why:
 * - Ensures request_id is consistently injected.
 * - Encourages stable event naming.
 * - Avoids accidental logging of raw Error objects (normalize first).
 *
 * Convention:
 * - Use short event names for stable queries (e.g. "HTTP_REQUEST", "BILLING_WEBHOOK").
 * - Put details in structured meta fields.
 */

import { logger } from "./logger.js";
import { getRequestContext } from "./request-context.js";

export type LogMeta = Record<string, unknown>;

function withCtx(meta?: LogMeta): LogMeta {
  const ctx = getRequestContext();
  if (!ctx) return meta ?? {};
  return {
    request_id: ctx.request_id,
    surface: ctx.surface,
    ...meta,
  };
}

export function info(event: string, meta?: LogMeta): void {
  logger.info({ event, ...withCtx(meta) }, event);
}

export function warn(event: string, meta?: LogMeta): void {
  logger.warn({ event, ...withCtx(meta) }, event);
}

export function error(event: string, meta?: LogMeta): void {
  logger.error({ event, ...withCtx(meta) }, event);
}

export function debug(event: string, meta?: LogMeta): void {
  logger.debug({ event, ...withCtx(meta) }, event);
}
