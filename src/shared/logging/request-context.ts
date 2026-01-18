// src/shared/logging/request-context.ts
/**
 * Request context via AsyncLocalStorage.
 *
 * Why:
 * - Ensures all logs can include request_id without threading it through every function.
 * - Provides a single correlation ID across routers, BalanceGuard, and deep helpers.
 *
 * Important:
 * - AsyncLocalStorage contexts should be created at the edge (HTTP handler / WS entrypoint).
 * - The callback passed to `runWithRequestContext` should be synchronous (eslint no-misused-promises).
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export type RequestContext = Readonly<{
  request_id: string;

  /**
   * Optional fields you can begin populating later:
   * - surface: "site" | "client" | "admin"
   * - ip: string
   * - actor: resolved identity summary
   *
   * Keep them optional so early scaffolding doesn't force plumbing everywhere.
   */
  surface?: "site" | "client" | "admin";
  ip?: string;
  actor?: { type: "anon" | "client" | "admin"; id?: string };
}>;

const als = new AsyncLocalStorage<RequestContext>();

export function createRequestContext(init?: Partial<RequestContext>): RequestContext {
  return {
    request_id: randomUUID(),
    ...init,
  };
}

/**
 * Run a function within a request context.
 *
 * eslint note:
 * - Keep `fn` sync to satisfy no-misused-promises.
 * - If you need async inside, launch an async IIFE inside the callback.
 */
export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return als.run(ctx, fn);
}

/**
 * Returns current request context, or null if not in a request scope.
 */
export function getRequestContext(): RequestContext | null {
  return als.getStore() ?? null;
}

/**
 * Convenience: fetch request_id for correlation when you can’t pass ctx down.
 */
export function getRequestId(): string | null {
  return als.getStore()?.request_id ?? null;
}
