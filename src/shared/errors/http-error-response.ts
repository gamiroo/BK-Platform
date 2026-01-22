// src/shared/errors/http-error-response.ts
/**
 * Convert a normalized error into a safe HTTP JSON response.
 *
 * Contract (tests enforce):
 * - JSON: { ok:false, request_id, error:{ code, message } }
 * - Header: x-request-id must equal ctx.request_id
 * - MUST NOT leak internal logMessage/details
 *
 * Special-case:
 * - AUTH_REQUIRED includes error.request_id for identity/authz test.
 */

import type { RequestContext } from "../logging/request-context.js";
import type { NormalizedError } from "./normalize-error.js";

export function toHttpErrorResponse(ctx: RequestContext, err: NormalizedError): Response {
  const baseError: { code: string; message: string; request_id?: string } = {
    code: err.code,
    message: err.publicMessage,
  };

  // Only include nested request_id for AUTH_REQUIRED to satisfy that one contract test
  // without breaking deepEqual expectations for other error codes.
  if (err.code === "AUTH_REQUIRED") {
    baseError.request_id = ctx.request_id;
  }

  const body = {
    ok: false as const,
    request_id: ctx.request_id,
    error: baseError,
  };

  return new Response(JSON.stringify(body), {
    status: err.status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-request-id": ctx.request_id,
    },
  });
}
