// src/shared/http/responses.ts
// Response helpers for the framework-free Node runtime.
// We use Web Fetch API Responses (Node 20+ has Response globally).
//
// Design goals:
// - Always return JSON in a consistent envelope
// - Always include request_id (observability)
// - Avoid leaking internal errors

import type { RequestContext } from "../logging/request-context.js";

export function json(
  ctx: RequestContext,
  data: unknown,
  init?: Omit<ResponseInit, "headers"> & { headers?: Record<string, string> }
): Response {
  const headers = new Headers(init?.headers ?? {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-request-id", ctx.request_id);

  // Never return undefined at the top-level JSON position (some clients mishandle it)
  const body = JSON.stringify({ ok: true, request_id: ctx.request_id, data });

  return new Response(body, { ...init, headers });
}

export function jsonError(
  ctx: RequestContext,
  status: number,
  code: string,
  message: string
): Response {
  const headers = new Headers();
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-request-id", ctx.request_id);

  const body = JSON.stringify({
    ok: false,
    request_id: ctx.request_id,
    error: { code, message },
  });

  return new Response(body, { status, headers });
}
