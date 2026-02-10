// src/shared/security/balanceguard/session-cookie-config.ts
/**
 * Session cookie configuration (BalanceGuard).
 *
 * Goals:
 * - Surface-isolated cookies (admin ≠ client)
 * - Cookie is only sent to the surface API path:
 *     /api/admin/* or /api/client/*
 *   This prevents admin cookies being attached to client API requests (and vice versa),
 *   even when both surfaces share a host in development.
 *
 * Production posture:
 * - Use "__Host-" prefix (requires Secure + Path=/ and no Domain attribute)
 *   HOWEVER: "__Host-" cookies MUST have Path=/ by spec.
 *   That conflicts with path-scoping.
 *
 * So we do:
 * - Dev: path-scoped cookies (best local isolation)
 * - Prod: "__Host-" cookies with Path=/ (best security posture + spec compliance)
 *
 * IMPORTANT:
 * - Never set Domain=... (host-only cookies are safer).
 */

import { loadRuntimeEnv } from "../../config/env.js";

export type Surface = "client" | "admin";

export type SessionCookieConfig = Readonly<{
  name: string;
  /**
   * Dev: path-scoped to /api/{surface}
   * Prod: "/" to satisfy "__Host-" requirements
   */
  path: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax" | "none";
}>;

function isProd(env: ReturnType<typeof loadRuntimeEnv>): boolean {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

function apiBasePath(surface: Surface): string {
  return surface === "admin" ? "/api/admin" : "/api/client";
}

export function sessionCookieConfig(surface: Surface): SessionCookieConfig {
  const env = loadRuntimeEnv();
  const prod = isProd(env);

  // Dev names
  const devName = surface === "admin" ? "bk_admin_session" : "bk_client_session";

  // Prod names (host-only hardened)
  const prodName =
    surface === "admin" ? "__Host-bk_admin_session" : "__Host-bk_client_session";

  return {
    name: prod ? prodName : devName,

    // ✅ Dev isolation; ✅ Prod "__Host-" compliance
    path: prod ? "/" : apiBasePath(surface),

    httpOnly: true,
    secure: prod,

    // If you deploy surfaces on different subdomains and call the API cross-site,
    // SameSite=None is required to send cookies cross-site.
    // In dev (same-site), Lax is fine.
    sameSite: prod ? "none" : "lax",
  };
}
