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
 * - We must respond to OPTIONS preflights for cross-origin fetch.
 * - We must attach Access-Control-* headers to ALL responses (including errors).
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

/**
 * Build a per-surface router. Avoid collisions like GET /health.
 * This runs at module init in Vercel, so keep it deterministic and fast.
 */
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

/**
 * Normalize incoming request path for a surface.
 * - /api/site            -> /
 * - /api/site/health     -> /health
 * - /api/site/foo/bar    -> /foo/bar
 */
function stripSurfacePrefix(req: Request, surface: Surface): Request {
  const u = new URL(req.url);
  const prefix = `/api/${surface}`;

  if (u.pathname === prefix) {
    u.pathname = "/";
  } else if (u.pathname.startsWith(prefix + "/")) {
    u.pathname = u.pathname.slice(prefix.length);
  }

  // Preserve method/headers/body/etc
  return new Request(u.toString(), req);
}

export function makeVercelHandler(surface: Surface) {
  const router = routers[surface];

  return async function handler(req: Request): Promise<Response> {
    const ctx: RequestContext = createRequestContext({ surface });

    return runWithRequestContext(ctx, () => {
      return (async () => {
        // Normalize early so even errors/preflight get correct CORS + logs
        const normalizedReq = stripSurfacePrefix(req, surface);

        try {
          logger.info(
            { request_id: ctx.request_id, surface, method: normalizedReq.method, url: normalizedReq.url },
            "vercel_http_request"
          );

          const preflight = handlePreflight(normalizedReq, surface);
          if (preflight) {
            return applySecurityHeaders(preflight);
          }

          let res: Response;

          // ✅ CORS preflight must short-circuit BEFORE routing/BalanceGuard
          if (normalizedReq.method.toUpperCase() === "OPTIONS") {
            res = new Response(null, { status: 204 });
          } else {
            res = await router.handle(ctx, normalizedReq);
          }

          // ✅ ALWAYS apply CORS headers, then security headers
          res = applyCors(normalizedReq, surface, res);
          res = applySecurityHeaders(res);

          return res;
        } catch (err) {
          logger.error(
            { request_id: ctx.request_id, surface, message: err instanceof Error ? err.message : String(err) },
            "vercel_http_error"
          );

          // ✅ Even error responses must get CORS headers
          let res = jsonError(ctx, 500, "INTERNAL_ERROR", "Unexpected error");
          res = applyCors(normalizedReq, surface, res);
          res = applySecurityHeaders(res);
          return res;
        }
      })();
    });
  };
}
