// src/shared/security/balanceguard/csrf.ts
/**
 * CSRF enforcement (Day 1).
 *
 * Strategy:
 * - For unsafe methods, require a CSRF token header.
 * - For Day 1, we enforce presence + a simple equality check against a cookie value.
 *
 * This is intentionally minimal; later we can:
 * - bind tokens to session + rotation
 * - double-submit cookie approach
 * - per-surface cookie names
 */

import { AppError } from "../../errors/app-error.js";

const CSRF_HEADER = "x-csrf-token";
const CSRF_COOKIE = "bk_csrf"; // later: per-surface names, e.g. bk_csrf_client, bk_csrf_admin

function parseCookieHeader(cookie: string | null): Record<string, string> {
  if (!cookie) return {};
  const out: Record<string, string> = {};
  for (const part of cookie.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") ?? "");
  }
  return out;
}

export function enforceCsrf(req: Request): void {
  const token = req.headers.get(CSRF_HEADER);
  if (!token) {
    throw new AppError({ code: "CSRF_REQUIRED", status: 403, message: "CSRF required" });
  }

  const cookies = parseCookieHeader(req.headers.get("cookie"));
  const cookieToken = cookies[CSRF_COOKIE];

  if (!cookieToken) {
    throw new AppError({ code: "CSRF_INVALID", status: 403, message: "CSRF invalid" });
  }

  if (cookieToken !== token) {
    throw new AppError({ code: "CSRF_INVALID", status: 403, message: "CSRF invalid" });
  }
}
