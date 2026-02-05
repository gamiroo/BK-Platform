// src/shared/security/balanceguard/balanceguard.ts
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
  if (opts.resolveActor) return defaultRequireAuth(opts.surface);
  return false;
}

/**
 * Production detection must be consistent with the rest of the codebase.
 * (We treat Vercel "production" as production too.)
 */
function isProdRuntime(): boolean {
  const nodeEnv = process.env.NODE_ENV;
  const vercelEnv = process.env.VERCEL_ENV;
  return nodeEnv === "production" || vercelEnv === "production";
}

function originsEnvKeyForSurface(surface: Surface): string | null {
  if (surface === "site") return "BK_ORIGINS_SITE";
  if (surface === "client") return "BK_ORIGINS_CLIENT";
  if (surface === "admin") return "BK_ORIGINS_ADMIN";
  return null;
}

function hasOriginAllowlistConfigured(surface: Surface): boolean {
  const key = originsEnvKeyForSurface(surface);
  if (!key) return true; // should not happen, but don't block on unknown surface
  const v = process.env[key];
  return typeof v === "string" && v.trim().length > 0;
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

      if (req.method === "OPTIONS") {
        return preflightResponse(opts.surface, req);
      }

      /**
       * ✅ Fail-closed in production if Origin enforcement is enabled but allowlist is missing.
       *
       * This is intentionally independent of request method:
       * - We still do NOT require Origin on safe GET/HEAD when allowlist exists.
       * - But if the allowlist is missing in prod, we must not silently run "open".
       *
       * This is what your failing test asserts.
       */
      if (opts.requireOrigin && isProdRuntime() && !hasOriginAllowlistConfigured(opts.surface)) {
        throw new AppError({
          code: "ORIGIN_REJECTED",
          status: 403,
          message: "Origin rejected",
          details: { reason: "no_allowlist_configured", surface: opts.surface },
        });
      }

      // Origin enforcement should only apply to "unsafe" methods.
      // Browsers may omit Origin on same-site GET/HEAD navigations (and some dev proxies),
      // and requiring it breaks /auth/me boot probes and refresh flows.
      const method = req.method.toUpperCase();
      const unsafe = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";

      if (opts.requireOrigin && unsafe) {
        enforceOrigin(req, opts.surface);
      }

      // CSRF only makes sense for authenticated surfaces.
      if (opts.requireCsrf && req.method !== "GET" && req.method !== "HEAD") {
        if (opts.surface === "site") {
          throw new AppError({ code: "CSRF_INVALID", status: 500, message: "CSRF misconfigured for site surface" });
        }
        enforceCsrf(req, opts.surface); // now opts.surface is narrowed
      }

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

      const actor: Actor = opts.resolveActor ? await opts.resolveActor(ctx, req) : { type: "anon" };

      if (computeRequireAuth(opts) && actor.type === "anon") {
        throw new AppError({
          code: "AUTH_REQUIRED",
          status: 401,
          message: "Auth required",
          details: {
            reason: "req_auth_1",
            surface: opts.surface,
          },
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
