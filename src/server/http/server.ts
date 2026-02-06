// src/server/http/server.ts
// Native Node HTTP server -> Fetch Request -> Router -> Fetch Response.
//
// Canonical "thin transport adapter" layer.
// - Only this file touches node:http primitives.
// - Router + BalanceGuard operate on Fetch Request/Response.
// - We apply security headers ONCE as the final step for every response.

import http from "node:http";

import { createRequestContext, runWithRequestContext } from "../../shared/logging/request-context.js";
import { logger } from "../../shared/logging/logger.js";
import { applySecurityHeaders } from "../../shared/http/headers.js";

import { normalizeError } from "../../shared/errors/normalize-error.js";
import { toHttpErrorResponse } from "../../shared/errors/http-error-response.js";

import { Router } from "./router.js";
import { registerSiteRoutes } from "./routes/site.routes.js";
import { registerClientRoutes } from "./routes/client.routes.js";
import { registerAdminRoutes } from "./routes/admin.routes.js";
import { registerWebhookRoutes } from "./routes/webhooks.routes.js";


async function readBody(req: http.IncomingMessage): Promise<Buffer | undefined> {
  // For GET/HEAD, no body
  const method = (req.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return undefined;

  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
    req.on("error", reject);
  });
}

type Surface = "site" | "client" | "admin" | "webhooks";

function routeSurface(pathname: string): Readonly<{ surface: Surface; strippedPathname: string }> {
  // Webhooks: do NOT use surface routers (no Origin/CSRF/auth).
  if (pathname === "/webhooks" || pathname.startsWith("/webhooks/")) {
    return { surface: "webhooks", strippedPathname: pathname };
  }
  // Mirror the Vercel catch-all behavior:
  // /api/<surface>/<anything> -> /<anything>
  // /api/<surface> -> /
  if (pathname === "/api/admin" || pathname.startsWith("/api/admin/")) {
    const rest = pathname.slice("/api/admin".length);
    return { surface: "admin", strippedPathname: rest.length ? rest : "/" };
  }

  if (pathname === "/api/client" || pathname.startsWith("/api/client/")) {
    const rest = pathname.slice("/api/client".length);
    return { surface: "client", strippedPathname: rest.length ? rest : "/" };
  }

  if (pathname === "/api/site" || pathname.startsWith("/api/site/")) {
    const rest = pathname.slice("/api/site".length);
    return { surface: "site", strippedPathname: rest.length ? rest : "/" };
  }

  // Default:
  // - Treat non-/api paths as "site" (useful for /health, /, etc. during early dev)
  return { surface: "site", strippedPathname: pathname };
}

/**
 * Convert node:http request into a Fetch API Request.
 * Node 20 provides global Request/Response.
 */
async function toFetchRequest(req: http.IncomingMessage, overriddenPathname: string): Promise<Request> {
  const host = req.headers.host ?? "localhost";
  const original = new URL(req.url ?? "/", `http://${host}`);

  // Apply our normalized pathname for routing
  original.pathname = overriddenPathname;

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(", "));
  }

  const body = await readBody(req);

  // With exactOptionalPropertyTypes, omit optional properties instead of passing undefined.
  const init: RequestInit = { method: req.method ?? "GET", headers };

  // DOM BodyInit typings don't accept Buffer directly; convert to Uint8Array.
  if (body) init.body = new Uint8Array(body);

  return new Request(original.toString(), init);
}

/**
 * Write a Fetch Response back to node:http response.
 *
 * IMPORTANT:
 * - `Set-Cookie` must preserve multiple header values.
 *   If we naïvely setHeader("set-cookie", value) in a loop, later cookies overwrite earlier ones.
 */
async function writeNodeResponse(res: http.ServerResponse, out: Response): Promise<void> {
  res.statusCode = out.status;

  // ✅ Special-case Set-Cookie (can be multiple)
  // Node's undici Headers exposes getSetCookie()
  const anyHeaders = out.headers as unknown as { getSetCookie?: () => string[] };
  const setCookies = anyHeaders.getSetCookie ? anyHeaders.getSetCookie() : [];

  // Write all headers except set-cookie
  out.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    res.setHeader(key, value);
  });

  if (setCookies.length > 0) {
    res.setHeader("set-cookie", setCookies);
  }

  if (!out.body) {
    res.end();
    return;
  }

  const ab = await out.arrayBuffer();
  res.end(Buffer.from(ab));
}


export function startHttpServer(port: number): http.Server {
  // Surface routers (avoid collisions in the single Router map)
  const siteRouter = new Router();
  const clientRouter = new Router();
  const adminRouter = new Router();
  const webhookRouter = new Router();

  registerSiteRoutes(siteRouter);
  registerClientRoutes(clientRouter);
  registerAdminRoutes(adminRouter);
  registerWebhookRoutes(webhookRouter);

  const server = http.createServer((req, res) => {
    const ctx = createRequestContext();

    runWithRequestContext(ctx, () => {
      void (async () => {
        try {
          const host = req.headers.host ?? "localhost";
          const url = new URL(req.url ?? "/", `http://${host}`);
          const routed = routeSurface(url.pathname);

          const fetchReq = await toFetchRequest(req, routed.strippedPathname);

          logger.info(
            {
              request_id: ctx.request_id,
              method: fetchReq.method,
              url: fetchReq.url,
              surface: routed.surface,
              original_path: url.pathname,
              routed_path: routed.strippedPathname,
            },
            "http_request"
          );

          const router =
            routed.surface === "webhooks"
              ? webhookRouter
              : routed.surface === "admin"
                ? adminRouter
                : routed.surface === "client"
                  ? clientRouter
                  : siteRouter;

          const fetchRes = await router.handle(ctx, fetchReq);

          const finalRes = applySecurityHeaders(fetchRes);
          await writeNodeResponse(res, finalRes);
        } catch (err) {
          const n = normalizeError(err);

          logger.error(
            {
              request_id: ctx.request_id,
              code: n.code,
              status: n.status,
              message: n.logMessage,
              details: n.details,
            },
            "http_unhandled_error"
          );

          const safe = applySecurityHeaders(toHttpErrorResponse(ctx, n));
          await writeNodeResponse(res, safe);
        }
      })();
    });
  });

  server.listen(port, () => {
    logger.info({ port }, "http_server_started");
  });

  return server;
}
