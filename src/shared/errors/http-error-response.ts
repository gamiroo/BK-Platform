// src/shared/errors/http-error-response.ts
/**
 * Convert a NormalizedError into the canonical HTTP JSON envelope.
 *
 * Why this exists:
 * - Keep *all* error responses consistent across transports (BalanceGuard, server adapter, etc.)
 * - Always include request_id for support/debug correlation
 * - Never leak internal details to clients
 *
 * Contract (tests rely on this):
 * - Response status = n.status
 * - Header: content-type = application/json; charset=utf-8
 * - Header: x-request-id = ctx.request_id
 * - Body:
 *   {
 *     ok: false,
 *     request_id: string,
 *     error: { code: string, message: string, details?: object }
 *   }
 *
 * Security rule:
 * - INTERNAL_ERROR must NEVER include error.details (even if normalizeError collected them for logs).
 */

import type { RequestContext } from "../logging/request-context.js";
import type { NormalizedError } from "./normalize-error.js";

type PublicErrorBody = Readonly<{
  ok: false;
  request_id: string;
  error: Readonly<{
    code: NormalizedError["code"];
    message: string;
    details?: Record<string, unknown>;
  }>;
}>;

function buildBody(ctx: RequestContext, n: NormalizedError): PublicErrorBody {
  const baseError = {
    code: n.code,
    message: n.publicMessage,
  } as const;

  // Only include details for *expected* errors.
  // INTERNAL_ERROR is always generic and must not include details.
  const error =
    n.code !== "INTERNAL_ERROR" && n.details
      ? ({ ...baseError, details: n.details } as const)
      : baseError;

  return {
    ok: false,
    request_id: ctx.request_id,
    error,
  };
}

export function toHttpErrorResponse(ctx: RequestContext, n: NormalizedError): Response {
  const body = buildBody(ctx, n);

  const headers = new Headers();
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-request-id", ctx.request_id);

  return new Response(JSON.stringify(body), {
    status: n.status,
    headers,
  });
}
