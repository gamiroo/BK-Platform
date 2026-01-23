// src/server/http/routes/site.routes.ts
// Site surface routes.
// This file defines real endpoints, so handlers MUST be BalanceGuard-wrapped.

import type { Router } from "../router.js";
import type { RequestContext } from "../../../shared/logging/request-context.js";
import { balanceguardSite } from "../../../shared/security/balanceguard/wrappers.js";
import { json } from "../../../shared/http/responses.js";
import { normalizeError } from "../../../shared/errors/normalize-error.js";
import { toHttpErrorResponse } from "../../../shared/errors/http-error-response.js";
import { applyCorsHeaders, preflightResponse  } from "../../../shared/http/cors.js";
import { createDb } from "../../../shared/db/client.js";
import {
  readDbEnvMarker,
  expectedMarkerFromRuntime,
  assertDbEnvMarker,
  runtimeEnvInput,
} from "../../../shared/db/env-marker.js";

import { submitEnquiry, validateEnquiryInput } from "../../../modules/enquiry/application/submit-enquiry.js";

function methodNotAllowed(ctx: RequestContext): Response {
  return toHttpErrorResponse(
    ctx,
    normalizeError(
      new Error("Method not allowed")
    )
  );
}

export function registerSiteRoutes(router: Router): void {

  router.get(
    "/health",
    balanceguardSite(async (ctx: RequestContext) => {
      const h = createDb();
      try {
        const expected = expectedMarkerFromRuntime(runtimeEnvInput());
        const actual = await readDbEnvMarker(h);
        assertDbEnvMarker(expected, actual);

        return json(ctx, { surface: "site", status: "ok", db_env: actual });
      } finally {
        await h.close();
      }
    })
  );

  router.options("/enquiry", async (_ctx, req) => preflightResponse("site", req));

  router.post(
    "/enquiry",
    balanceguardSite(
      {
        requireOrigin: true,
        requireCsrf: false,
        requireAuth: false,
        rateLimit: { max: 10, windowMs: 60_000 },
      },
      async (ctx: RequestContext, req: Request) => {
        const raw = await req.json().catch(() => null);
        const input = validateEnquiryInput(raw);
        const out = await submitEnquiry(input);

        const res = json(ctx, { lead_id: out.leadId });
        return applyCorsHeaders("site", req, res);
      }
    )
  );

  
  router.get(
    "/",
    balanceguardSite(async (ctx: RequestContext) => {
      return json(ctx, { surface: "site", status: "ok" });
    })
  );

  // Optional: explicit 405s if someone hits GET /enquiry
  router.get(
    "/enquiry",
    balanceguardSite(async (ctx: RequestContext) => {
      return methodNotAllowed(ctx);
    })
  );
}
