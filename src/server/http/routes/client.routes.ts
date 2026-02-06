// src/server/http/routes/client.routes.ts
// Client surface routes.

import type { RequestContext } from "../../../shared/logging/request-context.js";
import type { Router } from "../router.js";

import { balanceguardClient } from "../../../shared/security/balanceguard/wrappers.js";
import { json } from "../../../shared/http/responses.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { normalizeError } from "../../../shared/errors/normalize-error.js";
import { toHttpErrorResponse } from "../../../shared/errors/http-error-response.js";

import { readSessionId } from "../../../shared/security/balanceguard/session-cookie.js";
import { getIdentityRepository } from "../../../modules/identity/infrastructure/sessions-store.js";

import { clientAuthLogin } from "./client/auth.login.post.js";
import { clientAuthLogout } from "./client/auth.logout.post.js";

const CLIENT_COOKIE_DEV = "bk_client_session";
const ADMIN_COOKIE_DEV = "bk_admin_session";

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
        message: "Admin session cannot access client surface",
        details: { expected_cookie: CLIENT_COOKIE_DEV, got_cookie: ADMIN_COOKIE_DEV },
      })
    )
  );
}

export function registerClientRoutes(router: Router): void {
  router.get(
    "/",
    balanceguardClient(async (ctx: RequestContext) => json(ctx, { surface: "client", status: "ok" }))
  );

  router.get(
    "/health",
    balanceguardClient(async (ctx: RequestContext) => json(ctx, { surface: "client", status: "ok" }))
  );

  router.get(
    "/auth/me",
    balanceguardClient(
      { requireAuth: false, requireCsrf: false },
      async (ctx: RequestContext, req: Request) => {
        const hasClient = hasCookie(req, CLIENT_COOKIE_DEV);
        const hasAdmin = hasCookie(req, ADMIN_COOKIE_DEV);
        if (!hasClient && hasAdmin) return wrongSurface(ctx);

        const sessionId = readSessionId(req, "client");
        if (!sessionId) return unauthenticated(ctx);

        const repo = await getIdentityRepository();
        const user = await repo.resolveSession(sessionId, "client");
        if (!user) return unauthenticated(ctx);

        return json(ctx, { actor: { kind: "client", role: "client", user_id: user.id } });
      }
    )
  );

  // ✅ Canonical route modules (set CSRF + session)
  router.post("/auth/login", clientAuthLogin);

  // ✅ Canonical route module (CSRF-required + clear cookies)
  router.post("/auth/logout", clientAuthLogout);
}
