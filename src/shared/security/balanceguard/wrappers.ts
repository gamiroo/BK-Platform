// src/shared/security/balanceguard/wrappers.ts
// Surface-specific wrappers.
// These are what route modules should import and use.
// They ensure surface is explicit (no accidental cross-surface cookies / policies).

import type { BalanceGuardHandler } from "./balanceguard.js";
import { balanceguard } from "./balanceguard.js";

export function balanceguardSite(handler: BalanceGuardHandler): BalanceGuardHandler {
  return balanceguard(
    {
      surface: "site",
      // Day 0: health endpoint only; relaxed enforcement
      requireOrigin: false,
      requireCsrf: false,
    },
    handler
  );
}

export function balanceguardClient(handler: BalanceGuardHandler): BalanceGuardHandler {
  return balanceguard(
    {
      surface: "client",
      // Day 0: health endpoint only; relaxed enforcement (tighten later)
      requireOrigin: true,
      requireCsrf: true,
    },
    handler
  );
}

export function balanceguardAdmin(handler: BalanceGuardHandler): BalanceGuardHandler {
  return balanceguard(
    {
      surface: "admin",
      // Day 0: health endpoint only; relaxed enforcement (tighten later)
      requireOrigin: true,
      requireCsrf: true,
    },
    handler
  );
}
