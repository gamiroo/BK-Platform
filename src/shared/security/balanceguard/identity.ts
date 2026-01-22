// src/shared/security/balanceguard/identity.ts
/**
 * BalanceGuard identity resolution (canonical, session-based).
 *
 * Reads the surface session cookie, hashes the opaque token, then resolves
 * actor identity from the server-side sessions table.
 *
 * Fail-closed:
 * - missing/invalid cookie => anon
 * - no matching session => anon
 * - revoked/expired => anon
 * - surface mismatch => anon (defense-in-depth)
 */

import crypto from "node:crypto";

import type { Actor, Surface } from "./types.js";
import { createDb } from "../../db/client.js";
import { loadRuntimeEnv } from "../../config/env.ts";

type SessionRow = Readonly<{
  user_id: string;
}>;

function isProdRuntime(): boolean {
  const env = loadRuntimeEnv();
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

export function sessionCookieName(surface: Surface): string {
  // Per balanceguard.v3.md canonical cookie names.
  if (surface === "client") return isProdRuntime() ? "__Host-bk_client_session" : "bk_client_session";
  if (surface === "admin") return isProdRuntime() ? "__Host-bk_admin_session" : "bk_admin_session";

  // Site surface: no session cookie by default.
  return "bk_site_session";
}

function parseCookieHeader(raw: string | null): Record<string, string> {
  if (!raw) return {};
  const out: Record<string, string> = {};
  const parts = raw.split(";");
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx < 0) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    if (!k) continue;
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export async function resolveActorFromSession(surface: Surface, req: Request): Promise<Actor> {
  if (surface === "site") return { type: "anon" };

  const cookies = parseCookieHeader(req.headers.get("cookie"));
  const name = sessionCookieName(surface);
  const token = cookies[name];
  if (!token) return { type: "anon" };

  const tokenHash = sha256Hex(token);

  const h = createDb();
  try {
    // Defense-in-depth: verify surface match, session active, not revoked, not expired.
    const rows = await h.sql<SessionRow[]>`
      select user_id
      from sessions
      where token_hash = ${tokenHash}
        and surface = ${surface}
        and revoked_at is null
        and expires_at > now()
      limit 1
    `;

    const row = rows[0];
    if (!row) return { type: "anon" };

    if (surface === "client") return { type: "client", client_id: row.user_id };
    if (surface === "admin") return { type: "admin", admin_id: row.user_id };

    return { type: "anon" };
  } finally {
    await h.close();
  }
}
