// src/server/http/vercel-app.ts
/**
 * Vercel Functions adapter for Balance Kitchen API.
 *
 * This file exists so each Vercel Function entrypoint can share:
 * - a single Router instance (per function bundle)
 * - consistent RequestContext creation
 * - consistent error normalization + security headers
 *
 * IMPORTANT:
 * - No business logic here.
 * - All route modules remain thin and BalanceGuard-wrapped.
 */

import { applySecurityHeaders } from "../../shared/http/headers.js";
// import { jsonError } from "../../shared/http/responses.js";
import { normalizeError } from "../../shared/errors/normalize-error.js";
import { toHttpErrorResponse } from "../../shared/errors/http-error-response.js";
import { createRequestContext, runWithRequestContext } from "../../shared/logging/request-context.js";
import { logger } from "../../shared/logging/logger.js";

import { Router } from "./router.js";
import { registerSiteRoutes } from "./routes/site.routes.js";
import { registerClientRoutes } from "./routes/client.routes.js";
import { registerAdminRoutes } from "./routes/admin.routes.js";

type Surface = "site" | "client" | "admin";

let _router: Router | undefined;

/**
 * Lazily build the router once per function bundle.
 * This keeps cold-start work minimal while ensuring consistent route registration.
 */
function getRouter(): Router {
  if (_router) return _router;

  const r = new Router();
  registerSiteRoutes(r);
  registerClientRoutes(r);
  registerAdminRoutes(r);

  _router = r;
  return r;
}

/**
 * Build a Vercel Function handler that:
 * - creates a RequestContext
 * - runs within AsyncLocalStorage context
 * - calls the router
 * - applies security headers
 * - normalizes and safely returns errors
 */
export function makeVercelHandler(surface: Surface): (req: Request) => Promise<Response> {
  const router = getRouter();

  return async (req: Request): Promise<Response> => {
    const ctx = createRequestContext();

    return await runWithRequestContext(ctx, async () => {
      try {
        logger.info(
          { request_id: ctx.request_id, surface, method: req.method, url: req.url },
          "http_request"
        );

        const res = await router.handle(ctx, req);
        return applySecurityHeaders(res);
      } catch (err) {
        const n = normalizeError(err);

        logger.error(
          {
            request_id: ctx.request_id,
            surface,
            code: n.code,
            status: n.status,
            message: n.logMessage,
            ...(n.details ? { details: n.details } : {}),
          },
          "http_error"
        );

        return applySecurityHeaders(toHttpErrorResponse(ctx, n));
      }
    });
  };
}
