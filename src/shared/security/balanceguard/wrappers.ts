// src/shared/security/balanceguard/wrappers.ts
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

  /**
   * If omitted -> keep base rate limit.
   * If provided as `undefined` -> disable rate limit.
   * If provided as object -> override.
   */
  rateLimit?: WrapperRateLimit | undefined;
}>;

function policyForSurface(surface: Surface): RateLimitPolicy {
  switch (surface) {
    case "site":
      return { max: 120, windowMs: 60_000 };
    case "client":
    case "admin":
      return { max: 60, windowMs: 60_000 };
    default: {
      const _exhaustive: never = surface;
      return _exhaustive;
    }
  }
}

type BaseGuardOptions = Readonly<{
  surface: Surface;
  requireOrigin: boolean;
  requireCsrf: boolean;
  requireAuth: boolean;
  rateLimit: Readonly<{ store: RateLimitStore; max: number; windowMs: number }>;
  resolveActor?: (ctx: RequestContext, req: Request) => Promise<Actor>;
}>;

function makeBase(surface: Surface, store: RateLimitStore): BaseGuardOptions {
  const p = policyForSurface(surface);

  return {
    surface,
    requireOrigin: surface !== "site",
    requireCsrf: surface !== "site",
    requireAuth: false, // Day 0 default public-friendly
    rateLimit: { store, max: p.max, windowMs: p.windowMs },
  };
}

function makeSurfaceWrapper(surface: Surface) {
  const store = getHttpRateLimitStore();
  const base = makeBase(surface, store);

  function withDefaults(partial?: WrapperOpts): BalanceGuardOptions {
    const requireOrigin = partial?.requireOrigin ?? base.requireOrigin;
    const requireCsrf = partial?.requireCsrf ?? base.requireCsrf;
    const requireAuth = partial?.requireAuth ?? base.requireAuth;

    const rateLimitResolved =
      partial?.rateLimit === undefined
        ? base.rateLimit
        : partial.rateLimit
        ? { store, ...partial.rateLimit }
        : undefined;

    // IMPORTANT: only include optional props when defined
    const out: BalanceGuardOptions = {
      surface: base.surface,
      requireOrigin,
      requireCsrf,
      requireAuth,
      ...(base.resolveActor ? { resolveActor: base.resolveActor } : {}),
      ...(rateLimitResolved ? { rateLimit: rateLimitResolved } : {}),
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
    if (!b) throw new Error("balanceguard wrapper requires (opts, handler)");
    return balanceguard(withDefaults(a), wrapHandler(b));
  };
}

export const balanceguardSite = makeSurfaceWrapper("site");
export const balanceguardClient = makeSurfaceWrapper("client");
export const balanceguardAdmin = makeSurfaceWrapper("admin");

export type { Surface, Actor };
