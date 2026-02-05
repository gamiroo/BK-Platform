// src/server/http/routes/admin/auth.logout.post.ts
//
// Admin auth: logout
//
// Contract:
// - POST /api/admin/auth/logout
// - MUST require CSRF
// - Revokes admin session server-side (idempotent)
// - Clears admin session cookie
// - Clears CSRF cookies (per-surface + legacy)
//
// Notes:
// - This route is transport-only. It does not implement logout logic itself.
// - With Option A, logoutUseCase decides the revoke reason ("logout") by default.

import { balanceguardAdmin } from "../../../../shared/security/balanceguard/wrappers.js";
import { json } from "../../../../shared/http/responses.js";
import type { RequestContext } from "../../../../shared/logging/request-context.js";

import { readSessionId, clearSessionCookie } from "../../../../shared/security/balanceguard/session-cookie.js";
import { clearCsrfCookie } from "../../../../shared/security/balanceguard/csrf.js";
import { sessionCookieConfig } from "../../../../shared/security/balanceguard/session-cookie-config.js";

import { getIdentityRepository } from "../../../../modules/identity/infrastructure/sessions-store.js";
import { logoutUseCase } from "../../../../modules/identity/application/logout.usecase.js";

export const adminAuthLogout = balanceguardAdmin(
  // Logout is state-changing => CSRF required.
  // Auth is not required: logging out without a session should still succeed (idempotent).
  { requireAuth: false, requireCsrf: true },
  async (ctx: RequestContext, req: Request) => {
    // 1) Read session id from cookie (may be null -> idempotent logout)
    const sessionId = readSessionId(req, "admin");

    // 2) Revoke server-side session (safe if null/unknown/already revoked)
    // Option A: reason defaults to "logout" inside the use-case.
    const repo = await getIdentityRepository();
    await logoutUseCase(repo, sessionId);

    // 3) Clear cookies (client-side)
    // We return a stable success envelope and then mutate headers to clear cookies.
    const base = json(ctx, {});
    const headers = new Headers(base.headers);

    // Clear the admin session cookie
    clearSessionCookie(headers, "admin");

    // Clear CSRF cookies for the admin surface.
    // Cookie attributes must match those used when setting it, so we reuse the session cookie config.
    const cfg = sessionCookieConfig("admin");
    clearCsrfCookie(headers, "admin", { secure: cfg.secure, sameSite: cfg.sameSite });

    return new Response(base.body, { status: base.status, headers });
  },
);
