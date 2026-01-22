// src/shared/security/balanceguard/balanceguard.ts
// BalanceGuard (Day 0 implementation)
//
// Mandatory wrapper for every real HTTP endpoint.
// Enforces transport security + safe error normalization.
//
// Auth policy (important for tests + Day 0):
// - If opts.requireAuth is set, we obey it.
// - Else if opts.resolveActor is provided, we default:
//     site -> no auth required
//     client/admin -> auth required
// - Else (no identity hook), auth is NOT required (Day 0 public mode).

import type { RequestContext } from "../../logging/request-context.js";
import { securityLogger } from "../../logging/security-logger.js";

import { enforceOrigin } from "./origin.js";
import { enforceCsrf } from "./csrf.js";
import { extractIp } from "./ip.js";
import { enforceRateLimitHttp } from "./rate-limit.js";
import { applyCorsHeaders, preflightResponse } from "../../http/cors.js";

import { AppError } from "../../errors/app-error.js";
import { normalizeError } from "../../errors/normalize-error.js";
import { toHttpErrorResponse } from "../../errors/http-error-response.js";

import type { BalanceGuardOptions, Actor, Surface } from "./types.js";

export type BalanceGuardHandler = (ctx: RequestContext, req: Request) => Promise<Response>;

function defaultRouteKey(req: Request): string {
  const u = new URL(req.url);
  return `${req.method}:${u.pathname}`;
}

function defaultRequireAuth(surface: Surface): boolean {
  return surface !== "site";
}

function computeRequireAuth(opts: BalanceGuardOptions): boolean {
  if (opts.requireAuth !== undefined) return opts.requireAuth;

  // Only apply default auth rules when identity hook is in play.
  // Day 0 wrappers/tests without resolveActor must allow handler execution.
  if (opts.resolveActor) return defaultRequireAuth(opts.surface);

  return false;
}

export function balanceguard(opts: BalanceGuardOptions, handler: BalanceGuardHandler): BalanceGuardHandler {
  return async (ctx, req) => {
    const ip = extractIp(req);

    try {
      securityLogger.info("BG_HTTP_REQUEST", {
        surface: opts.surface,
        ip,
        method: req.method,
        url: req.url,
      });

      // CORS preflight must short-circuit BEFORE origin/csrf/rate-limit.
      if (req.method === "OPTIONS") {
        return preflightResponse(opts.surface, req);
      }


      // Origin
      if (opts.requireOrigin) {
        enforceOrigin(req, opts.surface);
      }

      // CSRF
      if (opts.requireCsrf && req.method !== "GET" && req.method !== "HEAD") {
        enforceCsrf(req);
      }

      // Rate limit (before handler)
      if (opts.rateLimit) {
        const routeKey = opts.rateLimit.routeKey ? opts.rateLimit.routeKey(req) : defaultRouteKey(req);

        await enforceRateLimitHttp({
          surface: opts.surface,
          ip,
          routeKey,
          max: opts.rateLimit.max,
          windowMs: opts.rateLimit.windowMs,
          store: opts.rateLimit.store,
        });
      }

      // Identity (hookable)
      const actor: Actor = opts.resolveActor ? await opts.resolveActor(ctx, req) : { type: "anon" };

      // Auth (see policy above)
      if (computeRequireAuth(opts) && actor.type === "anon") {
        throw new AppError({
          code: "AUTH_REQUIRED",
          status: 401,
          message: "Auth required",
        });
      }

      const res = await handler(ctx, req);
      return applyCorsHeaders(opts.surface, req, res);

    } catch (err) {
      const n = normalizeError(err);

      securityLogger.error("BG_HTTP_ERROR", {
        surface: opts.surface,
        ip,
        code: n.code,
        status: n.status,
        message: n.logMessage,
        details: n.details,
      });

      const res = toHttpErrorResponse(ctx, n);
      return applyCorsHeaders(opts.surface, req, res);

    }
  };
}
