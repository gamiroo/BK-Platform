// src/shared/errors/http-error-response.ts
/**
 * Convert a NormalizedError into a consistent HTTP JSON response.
 *
 * Rules:
 * - Always include request_id.
 * - Never expose internal stack traces to clients.
 * - Use stable code/message so clients can react safely.
 */

import type { RequestContext } from "../logging/request-context.js";
import type { NormalizedError } from "./normalize-error.js";

export function toHttpErrorResponse(ctx: RequestContext, n: NormalizedError): Response {
  const headers = new Headers();
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-request-id", ctx.request_id);

  const body = JSON.stringify({
    ok: false,
    request_id: ctx.request_id,
    error: {
      code: n.code,
      message: n.publicMessage,
    },
  });

  return new Response(body, { status: n.status, headers });
}
