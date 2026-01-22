// src/shared/security/balanceguard/rate-limit.ts
/**
 * BalanceGuard rate limiting.
 *
 * Contract:
 * - Deterministic and testable (store is injected).
 * - Keyed by: surface + ip + routeKey
 * - Fixed-window limit: allow up to `max` requests per `windowMs`.
 */

import { AppError } from "../../errors/app-error.js";

export type RateLimitResult = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtMs: number;
}>;

export type RateLimitStore = Readonly<{
  /**
   * Increment the counter for a key inside a fixed window.
   *
   * Returns:
   * - count: the count AFTER increment
   * - resetAtMs: when the window resets
   */
  incrFixedWindow: (key: string, windowMs: number) => Promise<Readonly<{ count: number; resetAtMs: number }>>;
}>;

export function createInMemoryRateLimitStore(): RateLimitStore {
  const buckets = new Map<string, { resetAtMs: number; count: number }>();

  return {
    incrFixedWindow: async (key, windowMs) => {
      const now = Date.now();
      const existing = buckets.get(key);

      if (!existing || existing.resetAtMs <= now) {
        const resetAtMs = now + windowMs;
        const next = { resetAtMs, count: 1 };
        buckets.set(key, next);
        return { count: 1, resetAtMs };
      }

      existing.count += 1;
      return { count: existing.count, resetAtMs: existing.resetAtMs };
    },
  };
}

/**
 * Redis-backed store (optional).
 *
 * Uses atomic INCR + PEXPIRE on first hit.
 */
export function createRedisRateLimitStore(redis: Readonly<{ incr: (k: string) => Promise<number>; pExpire: (k: string, ms: number) => Promise<number>; pTtl: (k: string) => Promise<number> }>): RateLimitStore {
  return {
    incrFixedWindow: async (key, windowMs) => {
      const now = Date.now();
      const count = await redis.incr(key);

      // If first hit, set expiry.
      if (count === 1) {
        await redis.pExpire(key, windowMs);
        return { count, resetAtMs: now + windowMs };
      }

      // Otherwise compute reset from TTL.
      const ttl = await redis.pTtl(key);
      const ttlSafe = ttl > 0 ? ttl : windowMs;
      return { count, resetAtMs: now + ttlSafe };
    },
  };
}

export function rateLimitKey(input: Readonly<{ surface: string; ip: string; routeKey: string }>): string {
  // Keep stable + low-cardinality; avoid raw URLs with query strings.
  return `bg:rl:${input.surface}:${input.ip}:${input.routeKey}`;
}

export async function enforceRateLimitHttp(input: Readonly<{
  surface: string;
  ip: string;
  routeKey: string;
  max: number;
  windowMs: number;
  store: RateLimitStore;
}>): Promise<RateLimitResult> {
  const k = rateLimitKey({ surface: input.surface, ip: input.ip, routeKey: input.routeKey });

  const { count, resetAtMs } = await input.store.incrFixedWindow(k, input.windowMs);

  const limit = input.max;
  const remaining = Math.max(0, limit - count);
  const allowed = count <= limit;

  if (!allowed) {
    throw new AppError({
      code: "RATE_LIMITED",
      status: 429,
      message: "Too many requests",
      details: {
        surface: input.surface,
        routeKey: input.routeKey,
        reset_at_ms: resetAtMs,
        limit,
      },
    });
  }

  return { allowed, limit, remaining, resetAtMs };
}
