// src/shared/http/responses.ts
/**
 * Canonical JSON response helpers.
 *
 * Contract (tests enforce):
 * - ok=true:  { ok:true, request_id, data }
 * - ok=false: { ok:false, request_id, error:{ code, message } }
 * - Header: x-request-id must equal ctx.request_id
 *
 * Special-case:
 * - AUTH_REQUIRED includes error.request_id for identity/authz test.
 */

import type { RequestContext } from "../logging/request-context.js";

export function json<T>(ctx: RequestContext, data: T, status = 200): Response {
  const body = {
    ok: true as const,
    request_id: ctx.request_id,
    data,
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-request-id": ctx.request_id,
    },
  });
}

export function jsonError(ctx: RequestContext, status: number, code: string, message: string): Response {
  const err: { code: string; message: string; request_id?: string } = { code, message };

  if (code === "AUTH_REQUIRED") {
    err.request_id = ctx.request_id;
  }

  const body = {
    ok: false as const,
    request_id: ctx.request_id,
    error: err,
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-request-id": ctx.request_id,
    },
  });
}
