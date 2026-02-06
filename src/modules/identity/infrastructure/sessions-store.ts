// src/modules/identity/infrastructure/sessions-store.ts

import { optionalEnv, loadRuntimeEnv } from "../../../shared/config/env.js";
import type { IdentityRepository } from "./repository.js";
import { DbIdentityRepository } from "./repository.db.js";
import { MemoryIdentityRepository } from "./repository.memory.js";

// ✅ Memoize per-process so login-created sessions are available to /me immediately (memory mode)
let repoPromise: Promise<IdentityRepository> | null = null;

export async function getIdentityRepository(): Promise<IdentityRepository> {
  if (repoPromise) return await repoPromise;

  repoPromise = (async () => {
    const runtime = loadRuntimeEnv();

    // Tests: deterministic, DB-independent
    if (runtime.NODE_ENV === "test") {
      return await MemoryIdentityRepository.createDefaultSeed();
    }

    const hasDb = optionalEnv("DATABASE_URL") !== undefined;

    // Production must never silently fall back to memory
    if (!hasDb && (runtime.NODE_ENV === "production" || runtime.VERCEL_ENV === "production")) {
      throw new Error("DATABASE_URL is required in production for IdentityRepository");
    }

    if (hasDb) return new DbIdentityRepository();

    // Local-dev convenience when DB not configured
    return await MemoryIdentityRepository.createDefaultSeed();
  })();

  return await repoPromise;
}
