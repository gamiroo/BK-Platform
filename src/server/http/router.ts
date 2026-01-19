// src/server/http/router.ts
// A minimal, deterministic HTTP router for a framework-free Node server.
//
// - Exact match routing (no params yet; add later if needed)
// - Method + pathname matching
// - Route handlers receive (ctx, req) so BalanceGuard can sit above them
//
// This file is intentionally small and boring: reliability > features.

import type { RequestContext } from "../../shared/logging/request-context.js";
import { jsonError } from "../../shared/http/responses.js";

export type RouteHandler = (ctx: RequestContext, req: Request) => Promise<Response>;

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RouteKey = `${Method} ${string}`;

function key(method: Method, path: string): RouteKey {
  return `${method} ${path}` as const;
}

export class Router {
  private readonly routes = new Map<RouteKey, RouteHandler>();

  get(path: string, handler: RouteHandler): void {
    this.routes.set(key("GET", path), handler);
  }
  post(path: string, handler: RouteHandler): void {
    this.routes.set(key("POST", path), handler);
  }
  put(path: string, handler: RouteHandler): void {
    this.routes.set(key("PUT", path), handler);
  }
  patch(path: string, handler: RouteHandler): void {
    this.routes.set(key("PATCH", path), handler);
  }
  delete(path: string, handler: RouteHandler): void {
    this.routes.set(key("DELETE", path), handler);
  }

  /**
   * Dispatch the request to a handler.
   * If no match is found, return a consistent JSON 404.
   */
  async handle(ctx: RequestContext, req: Request): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method.toUpperCase() as Method;

    const route = this.routes.get(key(method, url.pathname));
    if (!route) {
      return jsonError(ctx, 404, "NOT_FOUND", `No route for ${method} ${url.pathname}`);
    }

    return await route(ctx, req);
  }
}
