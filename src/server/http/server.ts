// src/server/http/server.ts
// Minimal native HTTP server skeleton.
// - This is NOT a full router yet.
// - It exists so you can boot the backend and prove request_id logging works.
// - BalanceGuard will wrap handlers later.

import http from "node:http";
import { createRequestContext, runWithRequestContext } from "../../shared/logging/request-context.js";
import { logger } from "../../shared/logging/logger.js";

export function startHttpServer(port: number): http.Server {
  const server = http.createServer((req, res) => {
    const ctx = createRequestContext();

    runWithRequestContext(ctx, () => {
      // Basic request log (do NOT log secrets; logger already redacts some fields)
      logger.info(
        {
          request_id: ctx.request_id,
          method: req.method,
          url: req.url,
        },
        "http_request"
      );

      // Minimal response
      res.statusCode = 200;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: true, request_id: ctx.request_id }));
    });
  });

  server.listen(port, () => {
    logger.info({ port }, "http_server_started");
  });

  return server;
}
