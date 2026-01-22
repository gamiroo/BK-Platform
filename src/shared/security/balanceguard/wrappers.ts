// src/shared/security/balanceguard/wrappers.ts
/**
 * BalanceGuard surface wrappers (mandatory).
 *
 * These are the ONLY exports route modules should use.
 * They enforce consistent security policy per surface.
 *
 * Day 0 policy:
 * - Origin/CSRF enabled for client/admin by default (you can relax per route if needed)
 * - Auth is NOT required by default (public endpoints like /health must work)
 * - Rate limiting enabled by default
 */

import type { RequestContext } from "../../logging/request-context.js";
import type { Actor, BalanceGuardOptions, Surface } from "./types.js";
import type { BalanceGuardHandler } from "./balanceguard.js";
import { balanceguard } from "./balanceguard.js";

import { getHttpRateLimitStore } from "./rate-limit-store.js";
import type { RateLimitStore } from "./rate-limit.js";

export type SurfaceHandler = (ctx: RequestContext, req: Request) => Promise<Response>;
export type CtxOnlyHandler = (ctx: RequestContext) => Promise<Response>;

function wrapHandler(handler: SurfaceHandler | CtxOnlyHandler): BalanceGuardHandler {
  return async (ctx, req) => {
    const fn = handler as unknown as (ctx: RequestContext, req?: Request) => Promise<Response>;
    return await fn(ctx, req);
  };
}

type RateLimitPolicy = Readonly<{ max: number; windowMs: number }>;

function policyForSurface(surface: Surface): RateLimitPolicy {
  switch (surface) {
    case "site":
      return { max: 120, windowMs: 60_000 };
    case "client":
      return { max: 60, windowMs: 60_000 };
    case "admin":
      return { max: 60, windowMs: 60_000 };
    default: {
      const _exhaustive: never = surface;
      return _exhaustive;
    }
  }
}

function makeOpts(surface: Surface, store: RateLimitStore): BalanceGuardOptions {
  const p = policyForSurface(surface);

  const out: BalanceGuardOptions = {
    surface,
    requireOrigin: surface !== "site",
    requireCsrf: surface !== "site",

    // IMPORTANT: Day 0 default is public-friendly.
    // Routes that require auth must opt-in explicitly later.
    requireAuth: false,

    rateLimit: {
      store,
      max: p.max,
      windowMs: p.windowMs,
    },
  };

  return out;
}

function makeSurfaceWrapper(surface: Surface) {
  const store = getHttpRateLimitStore();

  return (handler: SurfaceHandler | CtxOnlyHandler): BalanceGuardHandler => {
    return balanceguard(makeOpts(surface, store), wrapHandler(handler));
  };
}

export const balanceguardSite = makeSurfaceWrapper("site");
export const balanceguardClient = makeSurfaceWrapper("client");
export const balanceguardAdmin = makeSurfaceWrapper("admin");

export type { Surface, Actor };
