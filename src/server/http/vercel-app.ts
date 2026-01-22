// src/server/http/vercel-app.ts
/**
 * Vercel handler factory.
 *
 * IMPORTANT:
 * - Each surface gets its own Router to prevent route collisions.
 * - Vercel file-based routing means:
 *   - /api/site hits api/site.ts
 *   - /api/site/* hits api/site/[...path].ts
 * - We normalize /api/<surface>/<path> -> /<path> before routing.
 *
 * CORS:
 * - Must respond to OPTIONS preflights for cross-origin fetch.
 * - Must attach Access-Control-* headers to ALL responses (including errors/404s).
 */

import type { RequestContext } from "../../shared/logging/request-context.js";
import { createRequestContext, runWithRequestContext } from "../../shared/logging/request-context.js";
import { applySecurityHeaders } from "../../shared/http/headers.js";
import { applyCors, handlePreflight } from "../../shared/http/cors.js";
import { jsonError } from "../../shared/http/responses.js";
import { logger } from "../../shared/logging/logger.js";

import { Router } from "./router.js";
import { registerSiteRoutes } from "./routes/site.routes.js";
import { registerClientRoutes } from "./routes/client.routes.js";
import { registerAdminRoutes } from "./routes/admin.routes.js";

type Surface = "site" | "client" | "admin";

function buildRouter(surface: Surface): Router {
  const r = new Router();
  if (surface === "site") registerSiteRoutes(r);
  if (surface === "client") registerClientRoutes(r);
  if (surface === "admin") registerAdminRoutes(r);
  return r;
}

const routers: Record<Surface, Router> = {
  site: buildRouter("site"),
  client: buildRouter("client"),
  admin: buildRouter("admin"),
};

function stripSurfacePrefix(req: Request, surface: Surface): Request {
  const u = new URL(req.url);
  const prefix = `/api/${surface}`;

  if (u.pathname === prefix) {
    u.pathname = "/";
  } else if (u.pathname.startsWith(prefix + "/")) {
    u.pathname = u.pathname.slice(prefix.length);
  }

  return new Request(u.toString(), req);
}

export function makeVercelHandler(surface: Surface) {
  const router = routers[surface];

  return async function handler(req: Request): Promise<Response> {
    const ctx: RequestContext = createRequestContext({ surface });

    return runWithRequestContext(ctx, () => {
      return (async () => {
        const normalizedReq = stripSurfacePrefix(req, surface);

        try {
          logger.info(
            { request_id: ctx.request_id, surface, method: normalizedReq.method, url: normalizedReq.url },
            "vercel_http_request"
          );

          // ✅ Preflight MUST short-circuit BEFORE routing/BalanceGuard.
          const preflight = handlePreflight(normalizedReq, surface);
          if (preflight) {
            // preflight already has CORS headers; still apply security headers
            return applySecurityHeaders(preflight);
          }

          // Route normally (BalanceGuard is applied inside the route handlers)
          let res = await router.handle(ctx, normalizedReq);

          // ✅ Always apply CORS to all responses (including 404s)
          res = applyCors(normalizedReq, surface, res);

          // ✅ Then apply security headers
          res = applySecurityHeaders(res);

          return res;
        } catch (err) {
          logger.error(
            { request_id: ctx.request_id, surface, message: err instanceof Error ? err.message : String(err) },
            "vercel_http_error"
          );

          // ✅ Even error responses must have CORS headers
          let res = jsonError(ctx, 500, "INTERNAL_ERROR", "Unexpected error");
          res = applyCors(normalizedReq, surface, res);
          res = applySecurityHeaders(res);
          return res;
        }
      })();
    });
  };
}
