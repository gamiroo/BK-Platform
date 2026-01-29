// src/shared/security/balanceguard/origin.ts
import { AppError } from "../../errors/app-error.js";

export type Surface = "site" | "client" | "admin";

function parseCsv(v: string | undefined): string[] {
  if (!v) return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

function isHttpsVercelPreview(origin: string, prefix: string): boolean {
  return origin.startsWith(`https://${prefix}-`) && origin.endsWith(".vercel.app");
}

function allowedOriginsFor(surface: Surface): string[] {
  const key =
    surface === "site"
      ? "BK_ORIGINS_SITE"
      : surface === "client"
        ? "BK_ORIGINS_CLIENT"
        : "BK_ORIGINS_ADMIN";

  return parseCsv(process.env[key]);
}

export function enforceOrigin(req: Request, surface: Surface): void {
  const origin = req.headers.get("origin"); // string | null
  const allow = allowedOriginsFor(surface);

  // If no allowlist configured: fail-closed in prod, warn-open in dev
  if (allow.length === 0) {
    if (process.env.NODE_ENV === "production") {
      throw new AppError({
        code: "ORIGIN_REJECTED",
        status: 403,
        message: "Origin rejected",
        details: { reason: "no_allowlist_configured", surface },
      });
    }
    return;
  }

  // Require Origin header when origin checks are enabled
  if (!origin) {
    throw new AppError({
      code: "ORIGIN_REJECTED",
      status: 403,
      message: "Origin rejected",
      details: { reason: "missing_origin", surface },
    });
  }

  const vercelOk =
    surface === "site"
      ? isHttpsVercelPreview(origin, "site")
      : surface === "client"
        ? isHttpsVercelPreview(origin, "client")
        : isHttpsVercelPreview(origin, "admin");

  if (!allow.includes(origin) && !vercelOk) {
    throw new AppError({
      code: "ORIGIN_REJECTED",
      status: 403,
      message: "Origin rejected",
      details: { reason: "origin_not_allowed", origin, surface },
    });
  }
}
