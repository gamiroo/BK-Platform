// src/server/http/routes/admin.routes.ts
// Admin surface routes.

import type { Router } from "../router.js";
import { balanceguardAdmin } from "../../../shared/security/balanceguard/wrappers.js";
import { json } from "../../../shared/http/responses.js";

export function registerAdminRoutes(router: Router): void {
  router.get(
    "/health",
    balanceguardAdmin(async (ctx) => {
      return json(ctx, { surface: "admin", status: "ok" });
    })
  );
}
