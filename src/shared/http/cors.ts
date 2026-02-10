// src/shared/http/cors.ts
/**
 * CORS (surface-aware).
 *
 * Goals:
 * - Allow browser preflight (OPTIONS) to succeed
 * - Add CORS headers on all responses (when Origin is allowed)
 * - Deny-by-default for unknown origins
 *
 * Env:
 * - SITE_ORIGINS  = comma-separated list (e.g. "https://www.balancekitchen.com.au,https://site-xyz.vercel.app")
 * - CLIENT_ORIGINS = ...
 * - ADMIN_ORIGINS  = ...
 *
 * Notes:
 * - For authenticated surfaces (client/admin) you typically want credentials=true.
 * - For the marketing site, credentials are usually false.
 */

import type { Surface } from "../security/balanceguard/types.js";
import { loadRuntimeEnv } from "../config/env.js";
import { cloneHeadersPreserveSetCookie } from "./clone-headers.js";

type CorsDecision = Readonly<{
  allowed: boolean;
  allowCredentials: boolean;
  origin: string | null;
}>;

function splitCsv(raw: string | undefined): readonly string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function matchAllowedOrigin(origin: string, allowed: readonly string[]): boolean {
  return allowed.includes(origin);
}

function isHttpsVercelPreview(origin: string, prefix: string): boolean {
  // Example: https://site-xxxxx-gamiroos-projects.vercel.app
  return origin.startsWith(`https://${prefix}-`) && origin.endsWith(".vercel.app");
}

function decideCors(surface: Surface, origin: string | null): CorsDecision {
  if (!origin) return { allowed: false, allowCredentials: false, origin: null };

  const env = loadRuntimeEnv();
  const siteAllowed = splitCsv(env.BK_ORIGINS_SITE);
  const clientAllowed = splitCsv(env.BK_ORIGINS_CLIENT);
  const adminAllowed = splitCsv(env.BK_ORIGINS_ADMIN);

  if (surface === "site") {
    const allowed = matchAllowedOrigin(origin, siteAllowed) || isHttpsVercelPreview(origin, "site");
    return { allowed, allowCredentials: false, origin };
  }

  if (surface === "client") {
    const allowed = matchAllowedOrigin(origin, clientAllowed) || isHttpsVercelPreview(origin, "client");
    return { allowed, allowCredentials: true, origin };
  }

  const allowed = matchAllowedOrigin(origin, adminAllowed) || isHttpsVercelPreview(origin, "admin");
  return { allowed, allowCredentials: true, origin };
}

function corsHeaders(input: Readonly<{ surface: Surface; req: Request }>): Headers {
  const origin = input.req.headers.get("origin");
  const d = decideCors(input.surface, origin);

  const h = new Headers();

  if (!d.allowed || !d.origin) return h;

  h.set("Access-Control-Allow-Origin", d.origin);
  h.set("Vary", "Origin");
  h.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");

  const reqHeaders = input.req.headers.get("access-control-request-headers");
  h.set("Access-Control-Allow-Headers", reqHeaders && reqHeaders.length > 0 ? reqHeaders : "content-type");

  if (d.allowCredentials) {
    h.set("Access-Control-Allow-Credentials", "true");
  }

  h.set("Access-Control-Max-Age", "600");
  return h;
}

export function applyCorsHeaders(surface: Surface, req: Request, res: Response): Response {
  const extra = corsHeaders({ surface, req });
  if (extra.keys().next().done) return res;

  const next = cloneHeadersPreserveSetCookie(res.headers);
  extra.forEach((v, k) => next.set(k, v));

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: next,
  });
}

export function preflightResponse(surface: Surface, req: Request): Response {
  const extra = corsHeaders({ surface, req });

  if (extra.keys().next().done) {
    return new Response("CORS origin denied", { status: 403 });
  }

  return new Response(null, { status: 204, headers: extra });
}

export function applyCors(req: Request, surface: Surface, res: Response): Response {
  const extra = corsHeaders({ surface, req });
  if (extra.keys().next().done) return res;

  const next = cloneHeadersPreserveSetCookie(res.headers);

  extra.forEach((v, k) => {
    if (k.toLowerCase() === "vary") {
      const existing = next.get("Vary");
      if (!existing) next.set("Vary", v);
      else if (!existing.split(",").map((s) => s.trim()).includes("Origin")) {
        next.set("Vary", `${existing}, Origin`);
      }
      return;
    }
    next.set(k, v);
  });

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: next,
  });
}

export function handlePreflight(req: Request, surface: Surface): Response | null {
  if (req.method.toUpperCase() !== "OPTIONS") return null;

  try {
    const extra = corsHeaders({ surface, req });

    if (extra.keys().next().done) {
      return new Response("CORS origin denied", { status: 403 });
    }

    return new Response(null, { status: 204, headers: extra });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("CORS preflight error:", err);
    return new Response("CORS preflight error", { status: 500 });
  }
}
