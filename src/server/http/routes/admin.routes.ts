// src/server/http/routes/admin.routes.ts
// Admin surface routes.

import type { RequestContext } from "../../../shared/logging/request-context.js";
import type { Router } from "../router.js";
import { balanceguardAdmin } from "../../../shared/security/balanceguard/wrappers.js";
import { json } from "../../../shared/http/responses.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { normalizeError } from "../../../shared/errors/normalize-error.js";
import { toHttpErrorResponse } from "../../../shared/errors/http-error-response.js";

const ADMIN_COOKIE = "bk_admin_session";
const CLIENT_COOKIE = "bk_client_session";

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
        details: { expected_cookie: ADMIN_COOKIE, got_cookie: CLIENT_COOKIE },
      })
    )
  );
}

export function registerAdminRoutes(router: Router): void {
  router.get(
    "/",
    balanceguardAdmin(async (ctx: RequestContext) => {
      return json(ctx, { surface: "admin", status: "ok" });
    })
  );

  router.get(
    "/health",
    balanceguardAdmin(async (ctx: RequestContext) => {
      return json(ctx, { surface: "admin", status: "ok" });
    })
  );

  router.get(
    "/auth/me",
    balanceguardAdmin(
      { requireAuth: false, requireCsrf: false },
      async (ctx: RequestContext, req: Request) => {
        const hasAdmin = hasCookie(req, ADMIN_COOKIE);
        const hasClient = hasCookie(req, CLIENT_COOKIE);

        if (!hasAdmin && hasClient) return wrongSurface(ctx);
        if (!hasAdmin) return unauthenticated(ctx);

        return json(ctx, { actor: { kind: "admin" } });
      }
    )
  );
}
