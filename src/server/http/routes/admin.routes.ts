// src/server/http/routes/admin.routes.ts
// Admin surface routes.

import type { RequestContext } from "../../../shared/logging/request-context.js";
import type { Router } from "../router.js";

import { balanceguardAdmin } from "../../../shared/security/balanceguard/wrappers.js";
import { json } from "../../../shared/http/responses.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { normalizeError } from "../../../shared/errors/normalize-error.js";
import { toHttpErrorResponse } from "../../../shared/errors/http-error-response.js";

import { readSessionId } from "../../../shared/security/balanceguard/session-cookie.js";
import { getIdentityRepository } from "../../../modules/identity/infrastructure/sessions-store.js";
import { adminAuthLogin } from "./admin/auth.login.post.js";
import { adminAuthLogout } from "./admin/auth.logout.post.js";


const ADMIN_COOKIE_DEV = "bk_admin_session";
const CLIENT_COOKIE_DEV = "bk_client_session";

function hasCookie(req: Request, name: string): boolean {
  const raw = req.headers.get("cookie") ?? "";
  return raw
    .split(";")
    .map((p) => p.trim())
    .some((p) => p.startsWith(`${name}=`));
}

function unauthenticated(ctx: RequestContext): Response {
  return toHttpErrorResponse(
    ctx,
    normalizeError(
      new AppError({
        code: "UNAUTHENTICATED",
        status: 401,
        message: "Not logged in",
      })
    )
  );
}

function wrongSurface(ctx: RequestContext): Response {
  return toHttpErrorResponse(
    ctx,
    normalizeError(
      new AppError({
        code: "WRONG_SURFACE",
        status: 403,
        message: "Client session cannot access admin surface",
        details: { expected_cookie: ADMIN_COOKIE_DEV, got_cookie: CLIENT_COOKIE_DEV },
      })
    )
  );
}


export function registerAdminRoutes(router: Router): void {
  router.get(
    "/",
    balanceguardAdmin(async (ctx: RequestContext) => json(ctx, { surface: "admin", status: "ok" }))
  );

  router.get(
    "/health",
    balanceguardAdmin(async (ctx: RequestContext) => json(ctx, { surface: "admin", status: "ok" }))
  );

  /**
   * GET /auth/me
   *
   * Contract:
   * - If admin session present and valid -> 200 + actor.kind=admin
   * - If only client cookie -> 403 WRONG_SURFACE (+ safe details)
   * - If no session -> 401 UNAUTHENTICATED
   */
  router.get(
    "/auth/me",
    balanceguardAdmin(
      { requireAuth: false, requireCsrf: false },
      async (ctx: RequestContext, req: Request) => {
        // Wrong-surface guard for safe diagnostics
        const hasAdmin = hasCookie(req, ADMIN_COOKIE_DEV);
        const hasClient = hasCookie(req, CLIENT_COOKIE_DEV);
        if (!hasAdmin && hasClient) return wrongSurface(ctx);

        const sessionId = readSessionId(req, "admin");
        if (!sessionId) return unauthenticated(ctx);

        const repo = await getIdentityRepository();
        const user = await repo.resolveSession(sessionId, "admin");
        if (!user) return unauthenticated(ctx);

        return json(ctx, { actor: { kind: "admin", user_id: user.id } });
      }
    )
  );

  /**
   * POST /auth/login
   *
   * BalanceGuard posture:
   * - requireCsrf=false (no session yet)
   * - requireAuth=false
   * - keep requireOrigin enabled (default for admin surface)
   * - rate limit remains default unless overridden later
   */
  // ✅ Canonical route modules (set CSRF + session)
  router.post("/auth/login", adminAuthLogin);

  // ✅ Canonical route module (CSRF-required + clear cookies)
  router.post("/auth/logout", adminAuthLogout);
}
