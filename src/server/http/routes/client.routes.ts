// src/server/http/routes/client.routes.ts
// Client surface routes.

import type { RequestContext } from "../../../shared/logging/request-context.js";
import type { Router } from "../router.js";
import { balanceguardClient } from "../../../shared/security/balanceguard/wrappers.js";
import { json } from "../../../shared/http/responses.js";

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
}
