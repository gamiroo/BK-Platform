// src/shared/security/balanceguard/session-cookie.ts
/**
 * Cookie I/O for opaque session ids.
 *
 * Rules:
 * - Never encode identity claims in the cookie.
 * - Cookie value is an opaque session id.
 * - Session cookie is HttpOnly.
 *
 * Dev note:
 * - During migration, the same cookie name may exist at multiple Paths.
 *   Clearing MUST clear all possible Paths we previously used.
 */

import type { Surface } from "./session-cookie-config.js";
import { sessionCookieConfig } from "./session-cookie-config.js";

function parseCookieHeader(raw: string): Map<string, string> {
  const out = new Map<string, string>();

  raw
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const idx = pair.indexOf("=");
      if (idx <= 0) return;

      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();

      // Values are typically URL-encoded; decode safely.
      try {
        out.set(k, decodeURIComponent(v));
      } catch {
        out.set(k, v);
      }
    });

  return out;
}

function sameSiteAttr(v: "lax" | "none"): string {
  return v === "none" ? "None" : "Lax";
}

function buildSetCookie(
  name: string,
  value: string,
  cfg: Readonly<{ path: string; httpOnly?: boolean; secure?: boolean; sameSite: "lax" | "none" }>,
  extra?: readonly string[]
): string {
  const parts: string[] = [];
  parts.push(`${name}=${encodeURIComponent(value)}`);
  parts.push(`Path=${cfg.path}`);
  if (cfg.httpOnly) parts.push("HttpOnly");
  if (cfg.secure) parts.push("Secure");
  parts.push(`SameSite=${sameSiteAttr(cfg.sameSite)}`);
  if (extra) parts.push(...extra);
  return parts.join("; ");
}

export function readSessionId(req: Request, surface: Surface): string | null {
  const cfg = sessionCookieConfig(surface);
  const raw = req.headers.get("cookie") ?? "";
  const cookies = parseCookieHeader(raw);

  // We only look for the *current* configured cookie name.
  return cookies.get(cfg.name) ?? null;
}

export function hasAnySessionCookie(req: Request, cookieName: string): boolean {
  const raw = req.headers.get("cookie") ?? "";
  const cookies = parseCookieHeader(raw);
  return cookies.has(cookieName);
}

export function setSessionCookie(headers: Headers, surface: Surface, sessionId: string): void {
  const cfg = sessionCookieConfig(surface);

  headers.append(
    "set-cookie",
    buildSetCookie(cfg.name, sessionId, {
      path: cfg.path,
      httpOnly: true,
      secure: cfg.secure,
      sameSite: cfg.sameSite,
    })
  );
}

/**
 * Clear session cookie robustly.
 *
 * During rollout we may have set:
 * - Path=/ (older behavior)
 * - Path=/api/{surface} (new dev isolation)
 *
 * We clear BOTH to avoid zombie cookies.
 */
export function clearSessionCookie(headers: Headers, surface: Surface): void {
  const cfg = sessionCookieConfig(surface);

  const clear = (path: string): void => {
    headers.append(
      "set-cookie",
      buildSetCookie(
        cfg.name,
        "",
        {
          path,
          httpOnly: true,
          secure: cfg.secure,
          sameSite: cfg.sameSite,
        },
        ["Max-Age=0"]
      )
    );
  };

  // Clear current configured path
  clear(cfg.path);

  // Clear legacy alternate path to prevent duplicates
  if (cfg.path !== "/") clear("/");
  if (cfg.path !== "/api/admin" && surface === "admin") clear("/api/admin");
  if (cfg.path !== "/api/client" && surface === "client") clear("/api/client");
}
