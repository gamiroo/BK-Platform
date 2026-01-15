// src/shared/logging/request-context.ts
// Request context via AsyncLocalStorage.
// This allows any code (including deep helpers) to log with the same request_id
// without threading it through every function signature.
//
// IMPORTANT: Always initialize context at the edge (HTTP handler / WS entrypoint).

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export type RequestContext = Readonly<{
  request_id: string;
  // Extend later:
  // surface: "site" | "client" | "admin";
  // ip: string;
  // actor?: { type: "anon" | "client" | "admin"; id?: string };
}>;

const als = new AsyncLocalStorage<RequestContext>();

export function createRequestContext(): RequestContext {
  return { request_id: randomUUID() };
}

export function runWithRequestContext<T>(
  ctx: RequestContext,
  fn: () => T
): T {
  return als.run(ctx, fn);
}

export function getRequestContext(): RequestContext | null {
  return als.getStore() ?? null;
}
