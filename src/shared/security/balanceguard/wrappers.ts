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

type WrapperRateLimit = Readonly<{
  max: number;
  windowMs: number;
  routeKey?: (req: Request) => string;
}>;

type WrapperOpts = Readonly<{
  requireOrigin?: boolean;
  requireCsrf?: boolean;
  requireAuth?: boolean;
  rateLimit?: WrapperRateLimit;
}>;


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

type BaseGuardOptions = Omit<BalanceGuardOptions, "requireOrigin" | "requireCsrf" | "requireAuth"> & Readonly<{
  requireOrigin: boolean;
  requireCsrf: boolean;
  requireAuth: boolean;
}>;


function makeOpts(surface: Surface, store: RateLimitStore): BaseGuardOptions {
  const p = policyForSurface(surface);

  const out: BaseGuardOptions = {
    surface,
    requireOrigin: surface !== "site",
    requireCsrf: surface !== "site",

    // IMPORTANT: Day 0 default is public-friendly.
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

  function withDefaults(partial?: WrapperOpts): BalanceGuardOptions {
    const base = makeOpts(surface, store);

    const requireOrigin = partial?.requireOrigin ?? base.requireOrigin;
    const requireCsrf = partial?.requireCsrf ?? base.requireCsrf;
    const requireAuth = partial?.requireAuth ?? base.requireAuth;

    // Build rateLimit in an exactOptionalPropertyTypes-safe way:
    // - undefined => use base.rateLimit
    // - object => override with new max/windowMs/etc
    // - explicitly omitted/falsey never happens (WrapperOpts enforces shape)
    const computedRateLimit =
      partial?.rateLimit === undefined
        ? base.rateLimit
        : partial.rateLimit
          ? { store, ...partial.rateLimit }
          : undefined;

    // IMPORTANT:
    // - Do NOT set rateLimit: undefined
    // - Do NOT mutate resolveActor on a Readonly object
    const out: BalanceGuardOptions = {
      surface: base.surface,
      requireOrigin,
      requireCsrf,
      requireAuth,
      ...(computedRateLimit ? { rateLimit: computedRateLimit } : {}),
      ...(base.resolveActor ? { resolveActor: base.resolveActor } : {}),
    };

    return out;
  }

  // overloads
  return (a: WrapperOpts | SurfaceHandler | CtxOnlyHandler, b?: SurfaceHandler | CtxOnlyHandler): BalanceGuardHandler => {
    // (handler)
    if (typeof a === "function") {
      return balanceguard(withDefaults(), wrapHandler(a));
    }

    // (opts, handler)
    const opts = a;
    const handler = b;
    if (!handler) throw new Error("balanceguard wrapper requires (opts, handler)");

    return balanceguard(withDefaults(opts), wrapHandler(handler));
  };
}

export const balanceguardSite = makeSurfaceWrapper("site");
export const balanceguardClient = makeSurfaceWrapper("client");
export const balanceguardAdmin = makeSurfaceWrapper("admin");

export type { Surface, Actor };
