// src/server/http/routes/client.routes.ts
// Client surface routes.

import type { RequestContext } from "../../../shared/logging/request-context.js";
import type { Router } from "../router.js";
import { balanceguardClient } from "../../../shared/security/balanceguard/wrappers.js";
import { json } from "../../../shared/http/responses.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { normalizeError } from "../../../shared/errors/normalize-error.js";
import { toHttpErrorResponse } from "../../../shared/errors/http-error-response.js";

const CLIENT_COOKIE = "bk_client_session";
const ADMIN_COOKIE = "bk_admin_session";

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
        details: { expected_cookie: CLIENT_COOKIE, got_cookie: ADMIN_COOKIE },
      })
    )
  );
}

export function registerClientRoutes(router: Router): void {
  router.get(
    "/",
    balanceguardClient(async (ctx: RequestContext) => {
      return json(ctx, { surface: "client", status: "ok" });
    })
  );

  router.get(
    "/health",
    balanceguardClient(async (ctx: RequestContext) => {
      return json(ctx, { surface: "client", status: "ok" });
    })
  );

  router.get(
    "/auth/me",
    balanceguardClient(
      { requireAuth: false, requireCsrf: false },
      async (ctx: RequestContext, req: Request) => {
        const hasClient = hasCookie(req, CLIENT_COOKIE);
        const hasAdmin = hasCookie(req, ADMIN_COOKIE);

        if (!hasClient && hasAdmin) return wrongSurface(ctx);
        if (!hasClient) return unauthenticated(ctx);

        return json(ctx, { actor: { kind: "client" } });
      }
    )
  );
}
