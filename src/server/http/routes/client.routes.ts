// src/server/http/routes/client.routes.ts
// Client surface routes.

import type { Router } from "../router.js";
import { balanceguardClient } from "../../../shared/security/balanceguard/wrappers.js";
import { json } from "../../../shared/http/responses.js";

export function registerClientRoutes(router: Router): void {
  router.get(
    "/health",
    balanceguardClient(async (ctx) => {
      return json(ctx, { surface: "client", status: "ok" });
    })
  );
}
