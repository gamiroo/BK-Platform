// src/server/http/vercel-app.ts
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

  if (u.pathname === prefix) u.pathname = "/";
  else if (u.pathname.startsWith(prefix + "/")) u.pathname = u.pathname.slice(prefix.length);

  return new Request(u.toString(), req);
}

export function makeVercelHandler(surface: Surface) {
  const router = routers[surface];

  return async function handler(req: Request): Promise<Response> {
    const ctx: RequestContext = createRequestContext({ surface });

    return runWithRequestContext(ctx, async () => {
      const normalizedReq = stripSurfacePrefix(req, surface);

      try {
        logger.info(
          { request_id: ctx.request_id, surface, method: normalizedReq.method, url: normalizedReq.url },
          "vercel_http_request"
        );

        // ✅ preflight before anything else
        const preflight = handlePreflight(normalizedReq, surface);
        if (preflight) {
          return applySecurityHeaders(preflight);
        }

        const res = await router.handle(ctx, normalizedReq);

        // ✅ CORS on success responses
        return applySecurityHeaders(applyCors(normalizedReq, surface, res));
      } catch (err) {
        logger.error(
          { request_id: ctx.request_id, surface, message: err instanceof Error ? err.message : String(err) },
          "vercel_http_error"
        );

        // ✅ CORS on error responses too
        const errRes = jsonError(ctx, 500, "INTERNAL_ERROR", "Unexpected error");
        return applySecurityHeaders(applyCors(normalizedReq, surface, errRes));
      }
    });
  };
}
