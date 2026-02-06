// src/shared/security/balanceguard/csrf.ts
/**
 * CSRF enforcement (surface-aware).
 *
 * Strategy (double-submit):
 * - For unsafe methods, require x-csrf-token header.
 * - Compare it against a non-HttpOnly CSRF cookie for that surface.
 *
 * IMPORTANT:
 * - CSRF cookies must NOT be HttpOnly (frontend needs to read them).
 * - Session cookies remain HttpOnly.
 *
 * LEGACY REMOVAL:
 * - We no longer set or accept the legacy shared cookie (bk_csrf).
 *
 * MIGRATION NOTE (duplicate cookies):
 * - If older builds set bk_csrf_admin/bk_csrf_client with Path=/api/<surface>,
 *   and newer builds set them with Path=/, browsers can keep BOTH.
 * - We fix this by clearing the old Path cookies whenever we set/clear CSRF.
 */

import { AppError } from "../../errors/app-error.js";
import type { Surface as BgSurface } from "./types.js";

export type CsrfSurface = Exclude<BgSurface, "site">;

const CSRF_HEADER = "x-csrf-token";

/** Per-surface cookie name */
export function csrfCookieName(surface: CsrfSurface): string {
  return surface === "admin" ? "bk_csrf_admin" : "bk_csrf_client";
}

/** Older path we want to clear to remove duplicate cookies */
function legacyPathForSurface(surface: CsrfSurface): string {
  return surface === "admin" ? "/api/admin" : "/api/client";
}

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

function makeCsrfCookie(
  name: string,
  value: string,
  secure: boolean,
  sameSite: "lax" | "none",
  path: string
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `SameSite=${sameSite === "none" ? "None" : "Lax"}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function makeClearCookie(
  name: string,
  secure: boolean,
  sameSite: "lax" | "none",
  path: string
): string {
  const parts = [
    `${name}=`,
    `Path=${path}`,
    "Max-Age=0",
    `SameSite=${sameSite === "none" ? "None" : "Lax"}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Attach CSRF cookie to response headers (per-surface ONLY).
 * Also clears old per-surface cookie that may exist at /api/<surface>.
 */
export function setCsrfCookie(
  headers: Headers,
  surface: CsrfSurface,
  token: string,
  opts?: Readonly<{ secure?: boolean; sameSite?: "lax" | "none" }>
): void {
  const secure = opts?.secure ?? false;
  const sameSite = opts?.sameSite ?? "lax";

  const name = csrfCookieName(surface);

  // 1) Clear old duplicate cookie path if it exists (migration cleanup)
  headers.append("set-cookie", makeClearCookie(name, secure, sameSite, legacyPathForSurface(surface)));

  // 2) Set the canonical cookie path so the frontend can read it from /admin/* or /client/*
  headers.append("set-cookie", makeCsrfCookie(name, token, secure, sameSite, "/"));
}

/**
 * Clear CSRF cookie (per-surface ONLY).
 * Clears both canonical Path=/ and the old Path=/api/<surface>.
 */
export function clearCsrfCookie(
  headers: Headers,
  surface: CsrfSurface,
  opts?: Readonly<{ secure?: boolean; sameSite?: "lax" | "none" }>
): void {
  const secure = opts?.secure ?? false;
  const sameSite = opts?.sameSite ?? "lax";

  const name = csrfCookieName(surface);

  headers.append("set-cookie", makeClearCookie(name, secure, sameSite, "/"));
  headers.append("set-cookie", makeClearCookie(name, secure, sameSite, legacyPathForSurface(surface)));
}

/**
 * Enforce CSRF for unsafe methods.
 * - header required
 * - must equal the per-surface cookie
 */
export function enforceCsrf(req: Request, surface: CsrfSurface): void {
  const token = req.headers.get(CSRF_HEADER);
  if (!token) {
    throw new AppError({ code: "CSRF_REQUIRED", status: 403, message: "CSRF required" });
  }

  const cookies = parseCookieHeader(req.headers.get("cookie"));
  const cookieToken = cookies[csrfCookieName(surface)];

  if (!cookieToken) {
    throw new AppError({ code: "CSRF_INVALID", status: 403, message: "CSRF invalid" });
  }

  if (cookieToken !== token) {
    throw new AppError({ code: "CSRF_INVALID", status: 403, message: "CSRF invalid" });
  }
}
