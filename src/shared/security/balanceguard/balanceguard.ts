// src/shared/security/balanceguard/balanceguard.ts
// BalanceGuard (Day 0 implementation)
//
// This wrapper is mandatory for every real HTTP endpoint.
// It is a thin orchestration layer that:
// - Extracts request metadata (surface, ip)
// - Provides hooks for Origin / CSRF / RateLimit / Identity / AuthZ
// - Normalizes and safely responds on errors
//
// IMPORTANT:
// - No business logic here. BalanceGuard only enforces transport security.
// - Security headers should be applied once at the transport edge (server adapter).
//   (We apply them in src/server/http/server.ts as the final step.)

import type { RequestContext } from "../../logging/request-context.js";
import { securityLogger } from "../../logging/security-logger.js";

import { enforceOrigin } from "./origin.js";
import { enforceCsrf } from "./csrf.js";

import { normalizeError } from "../../errors/normalize-error.js";
import { toHttpErrorResponse } from "../../errors/http-error-response.js";

import type { BalanceGuardOptions, Actor } from "./types.js";
import { extractIp } from "./ip.js";

export type BalanceGuardHandler = (ctx: RequestContext, req: Request) => Promise<Response>;

export function balanceguard(
  opts: BalanceGuardOptions,
  handler: BalanceGuardHandler
): BalanceGuardHandler {
  return async (ctx, req) => {
    const ip = extractIp(req);

    // (Optional) enrich ctx for downstream log helpers.
    // We avoid mutating ctx (readonly) — if you want ctx enrichment, do it at ctx creation
    // in server.ts instead. For Day 0, we log these fields directly here.

    try {
      // ---- (A) Metadata / audit hooks
      securityLogger.info("BG_HTTP_REQUEST", {
        surface: opts.surface,
        ip,
        method: req.method,
        url: req.url,
      });

      // ---- (B) Origin enforcement hook (future)
      if (opts.requireOrigin) {
        // Throw AppError({ code: "ORIGIN_REJECTED", status: 403, message: "Origin rejected" })
        if (opts.requireOrigin) {
            enforceOrigin(req, opts.surface);
        }
      }

      // ---- (C) CSRF enforcement hook (future)
      if (opts.requireCsrf && req.method !== "GET" && req.method !== "HEAD") {
        // Throw AppError({ code: "CSRF_INVALID", status: 403, message: "CSRF invalid" })
        if (opts.requireCsrf && req.method !== "GET" && req.method !== "HEAD") {
            enforceCsrf(req);
        }
      }

      // ---- (D) Rate limiting hook (future)
      // TODO: implement enforceRateLimitHttp(ip, opts.surface)

      // ---- (E) Resolve actor hook (future)
      // For Day 0: everything is anonymous.
      const actor: Actor = { type: "anon" };
      void actor; // silence lint until the authz hook is implemented

      // ---- (F) AuthZ hook (future)
      // TODO: enforceAuthz(actor, opts.surface, req)

      // ---- (G) Call actual handler
      return await handler(ctx, req);
    } catch (err) {
      const n = normalizeError(err);

      // Log for operators: include code/status and safe details for debugging.
      securityLogger.error("BG_HTTP_ERROR", {
        surface: opts.surface,
        ip,
        code: n.code,
        status: n.status,
        message: n.logMessage,
        details: n.details,
      });

      // Safe client response (no stack traces, always includes request_id).
      return toHttpErrorResponse(ctx, n);
    }
  };
}
