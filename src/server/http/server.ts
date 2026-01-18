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

/**
 * Convert node:http request into a Fetch API Request.
 * Node 20 provides global Request/Response.
 */
async function toFetchRequest(req: http.IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);

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

  return new Request(url.toString(), init);
}

/**
 * Write a Fetch Response back to node:http response.
 */
async function writeNodeResponse(res: http.ServerResponse, out: Response): Promise<void> {
  res.statusCode = out.status;
  out.headers.forEach((value, key) => res.setHeader(key, value));

  if (!out.body) {
    res.end();
    return;
  }

  const ab = await out.arrayBuffer();
  res.end(Buffer.from(ab));
}

export function startHttpServer(port: number): http.Server {
  // Router setup
  const router = new Router();

  // Register surface route modules
  registerSiteRoutes(router);
  registerClientRoutes(router);
  registerAdminRoutes(router);

  const server = http.createServer((req, res) => {
    const ctx = createRequestContext();

    runWithRequestContext(ctx, () => {
      // IMPORTANT:
      // - node:http expects a void-returning request listener
      // - ALS context should be established synchronously
      // - then we launch async work explicitly
      void (async () => {
        try {
          const fetchReq = await toFetchRequest(req);

          logger.info(
            { request_id: ctx.request_id, method: fetchReq.method, url: fetchReq.url },
            "http_request"
          );

          // Router returns a Response. BalanceGuard-wrapped handlers will also return Responses.
          const fetchRes = await router.handle(ctx, fetchReq);

          // Apply security headers ONCE, as the final step for every response.
          const finalRes = applySecurityHeaders(fetchRes);

          await writeNodeResponse(res, finalRes);
        } catch (err) {
          // Transport adapter safety net: if anything escapes BalanceGuard/router,
          // we normalize and fail closed with a safe JSON response.
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
