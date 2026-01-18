// src/server/http/routes/site.routes.ts
// Site surface routes.
// This file defines real endpoints, so handlers MUST be BalanceGuard-wrapped.

import type { Router } from "../router.js";
import { balanceguardSite } from "../../../shared/security/balanceguard/wrappers.js";
import { json } from "../../../shared/http/responses.js";

export function registerSiteRoutes(router: Router): void {
  router.get(
    "/health",
    balanceguardSite(async (ctx) => {
      return json(ctx, { surface: "site", status: "ok" });
    })
  );
}
