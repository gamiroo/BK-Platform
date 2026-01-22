// src/shared/security/balanceguard/rate-limit-store.ts
/**
 * Rate limit store wiring (BalanceGuard).
 *
 * Goals:
 * - Routes/wrappers can obtain a RateLimitStore synchronously
 * - Redis connection is NOT opened at import time (lazy init)
 * - In dev/test without REDIS_URL, fall back to in-memory store
 * - In production (or VERCEL_ENV=production), REDIS_URL is REQUIRED (fail-closed)
 */

import { AppError } from "../../errors/app-error.js";
import { loadRuntimeEnv } from "../../config/env.js";
import { createRedis } from "../../infra/redis/client.js";
import {
  createInMemoryRateLimitStore,
  createRedisRateLimitStore,
  type RateLimitStore,
} from "./rate-limit.js";

type State =
  | Readonly<{ kind: "uninitialized" }>
  | Readonly<{ kind: "ready"; store: RateLimitStore }>
  | Readonly<{ kind: "failed"; error: unknown }>;

let state: State = { kind: "uninitialized" };
let init: Promise<RateLimitStore> | null = null;

export function getHttpRateLimitStore(): RateLimitStore {
  return {
    incrFixedWindow: async (key, windowMs) => {
      const s = await ensureStore();
      return await s.incrFixedWindow(key, windowMs);
    },
  };
}

async function ensureStore(): Promise<RateLimitStore> {
  if (state.kind === "ready") return state.store;
  if (state.kind === "failed") throw state.error;
  if (init) return init;

  init = (async () => {
    const env = loadRuntimeEnv();
    const isProd = env.NODE_ENV === "production" || env.VERCEL_ENV === "production";

    if (!env.REDIS_URL) {
      if (isProd) {
        throw new AppError({
          code: "INTERNAL_ERROR",
          status: 500,
          message: "Redis is required in production for rate limiting",
          details: { missing: "REDIS_URL" },
        });
      }

      const mem = createInMemoryRateLimitStore();
      state = { kind: "ready", store: mem };
      return mem;
    }

    const rh = await createRedis(env.REDIS_URL);
    const store = createRedisRateLimitStore(rh.commands);

    state = { kind: "ready", store };
    return store;
  })();

  try {
    return await init;
  } catch (err) {
    state = { kind: "failed", error: err };
    throw err;
  } finally {
    init = null;
  }
}
