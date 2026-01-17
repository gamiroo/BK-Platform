// src/shared/security/balanceguard/origin.ts
/**
 * Origin enforcement (surface-aware).
 *
 * Goal:
 * - For authenticated surfaces (client/admin), reject requests with invalid/missing Origin
 *   to mitigate CSRF and cross-site request abuse.
 *
 * Notes:
 * - For same-origin requests, browsers send Origin for "unsafe" methods and often for CORS.
 * - Non-browser clients may omit Origin; decide policy per surface.
 * - Day 1: we enforce only when requireOrigin is true.
 */

import { AppError } from "../../errors/app-error.js";

export type Surface = "site" | "client" | "admin";

function parseCsv(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function allowedOriginsFor(surface: Surface): string[] {
  // Configure in env (Vercel) per environment.
  // Example:
  // BK_ORIGINS_SITE=https://balancekitchen.com
  // BK_ORIGINS_CLIENT=https://client.balancekitchen.com
  // BK_ORIGINS_ADMIN=https://admin.balancekitchen.com
  const key =
    surface === "site"
      ? "BK_ORIGINS_SITE"
      : surface === "client"
        ? "BK_ORIGINS_CLIENT"
        : "BK_ORIGINS_ADMIN";

  return parseCsv(process.env[key]);
}

export function enforceOrigin(req: Request, surface: Surface): void {
  const origin = req.headers.get("origin");

  // If no allowlist is configured, fail closed in production, warn-open in dev.
  const allow = allowedOriginsFor(surface);
  if (allow.length === 0) {
    if (process.env.NODE_ENV === "production") {
      throw new AppError({
        code: "ORIGIN_REJECTED",
        status: 403,
        message: "Origin rejected",
        details: { reason: "no_allowlist_configured", surface },
      });
    }
    // Dev convenience: no allowlist configured; do not block.
    return;
  }

  if (!origin) {
    throw new AppError({
      code: "ORIGIN_REJECTED",
      status: 403,
      message: "Origin rejected",
      details: { reason: "missing_origin", surface },
    });
  }

  if (!allow.includes(origin)) {
    throw new AppError({
      code: "ORIGIN_REJECTED",
      status: 403,
      message: "Origin rejected",
      details: { reason: "origin_not_allowed", origin, surface },
    });
  }
}
