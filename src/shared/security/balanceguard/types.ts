// src/shared/security/balanceguard/types.ts
// Shared BalanceGuard types.
// Keep these stable: many layers import them.

import type { RequestContext } from "../../logging/request-context.js";
import type { RateLimitStore } from "./rate-limit.js";

export type Surface = "site" | "client" | "admin";

export type Actor =
  | { type: "anon" }
  | { type: "client"; client_id: string }
  | { type: "admin"; admin_id: string };

export type BalanceGuardRateLimit = Readonly<{
  /**
   * Store adapter (in-memory for tests, Redis in production).
   */
  store: RateLimitStore;

  /**
   * Max requests allowed in the window.
   */
  max: number;

  /**
   * Fixed window size in milliseconds.
   */
  windowMs: number;

  /**
   * Optional override for how to bucket a request.
   * Default is "METHOD:pathname" (no query string).
   */
  routeKey?: (req: Request) => string;
}>;

export type BalanceGuardOptions = Readonly<{
  surface: Surface;

  /**
   * If true, we enforce Origin checks (recommended for authenticated surfaces).
   */
  requireOrigin?: boolean;

  /**
   * If true, enforce CSRF for unsafe methods (POST/PUT/PATCH/DELETE).
   */
  requireCsrf?: boolean;

  /**
   * If set, overrides the default auth policy.
   *
   * Default policy (when undefined):
   * - site: auth NOT required
   * - client/admin: auth required
   *
   * Wrappers may override this to keep specific routes public (e.g. /health).
   */
  requireAuth?: boolean;

  /**
   * Actor resolution hook.
   *
   * Day 0 tests use this hook to simulate identity without implementing sessions yet.
   * When absent, BalanceGuard assumes anon.
   */
  resolveActor?: (ctx: RequestContext, req: Request) => Promise<Actor>;

  /**
   * Optional rate limiting. If set, BalanceGuard enforces it before calling the handler.
   */
  rateLimit?: BalanceGuardRateLimit;
}>;
