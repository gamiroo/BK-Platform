// src/shared/infra/redis/client.ts
/**
 * Redis client (infra-only).
 *
 * Goals:
 * - No connection at import time
 * - Structural typing to avoid RedisClientType incompatibilities under strict TS
 * - Minimal command surface for BalanceGuard rate limiting
 */

import { AppError } from "../../errors/app-error.js";

export type RedisRateLimitCommands = Readonly<{
  incr: (key: string) => Promise<number>;
  pExpire: (key: string, ms: number) => Promise<number>;
  pTtl: (key: string) => Promise<number>;
}>;

export type RedisHandle = Readonly<{
  commands: RedisRateLimitCommands;
  close: () => Promise<void>;
}>;

let singleton: RedisHandle | null = null;
let connecting: Promise<RedisHandle> | null = null;

export async function createRedis(url: string): Promise<RedisHandle> {
  if (singleton) return singleton;
  if (connecting) return connecting;

  connecting = (async () => {
    const mod = await import("redis");
    const client: {
      connect: () => Promise<void>;
      quit: () => Promise<void>;
      incr: (k: string) => Promise<number>;
      pExpire: (k: string, ms: number) => Promise<number>;
      pTTL: (k: string) => Promise<number>;
    } = mod.createClient({ url }) as unknown as {
      connect: () => Promise<void>;
      quit: () => Promise<void>;
      incr: (k: string) => Promise<number>;
      pExpire: (k: string, ms: number) => Promise<number>;
      pTTL: (k: string) => Promise<number>;
    };

    try {
      await client.connect();
    } catch (err) {
      throw new AppError({
        code: "INTERNAL_ERROR",
        status: 500,
        message: "Redis connection failed",
        details: { reason: err instanceof Error ? err.message : String(err) },
        cause: err,
      });
    }

    const handle: RedisHandle = {
      commands: {
        incr: async (key) => await client.incr(key),
        pExpire: async (key, ms) => await client.pExpire(key, ms),
        pTtl: async (key) => await client.pTTL(key),
      },
      close: async () => {
        await client.quit();
      },
    };

    singleton = handle;
    return handle;
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}
