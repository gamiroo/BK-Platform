// src/shared/security/balanceguard/authz.ts
/**
 * BalanceGuard AuthZ (deny-by-default).
 *
 * Contract:
 * - site allows anonymous access (public surface)
 * - client requires client session
 * - admin requires admin session
 *
 * Errors (canonical):
 * - AUTH_REQUIRED (401) when no valid session
 * - FORBIDDEN (403) when wrong role/surface
 */

import { AppError } from "../../errors/app-error.js";
import type { Actor, Surface } from "./types.js";

export function enforceAuthz(input: Readonly<{ surface: Surface; actor: Actor }>): void {
  const { surface, actor } = input;

  if (surface === "site") {
    // Public surface: allow anon for now.
    return;
  }

  if (actor.type === "anon") {
    throw new AppError({
      code: "AUTH_REQUIRED",
      status: 401,
      message: "Authentication required",
    });
  }

  if (surface === "client") {
    if (actor.type !== "client") {
      throw new AppError({
        code: "FORBIDDEN",
        status: 403,
        message: "Forbidden",
      });
    }
    return;
  }

  if (surface === "admin") {
    if (actor.type !== "admin") {
      throw new AppError({
        code: "FORBIDDEN",
        status: 403,
        message: "Forbidden",
      });
    }
    return;
  }

  const _exhaustive: never = surface;
  return _exhaustive;
}
