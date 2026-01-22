// src/server/http/routes/site.routes.ts
// Site surface routes.
// This file defines real endpoints, so handlers MUST be BalanceGuard-wrapped.

import type { Router } from "../router.js";
import type { RequestContext } from "../../../shared/logging/request-context.js";
import { balanceguardSite } from "../../../shared/security/balanceguard/wrappers.js";
import { json } from "../../../shared/http/responses.js";
import { normalizeError } from "../../../shared/errors/normalize-error.js";
import { toHttpErrorResponse } from "../../../shared/errors/http-error-response.js";

import { createDb } from "../../../shared/db/client.js";
import {
  readDbEnvMarker,
  expectedMarkerFromRuntime,
  assertDbEnvMarker,
  runtimeEnvInput,
} from "../../../shared/db/env-marker.js";

import { submitEnquiry, validateEnquiryInput } from "../../../modules/enquiry/application/submit-enquiry.js";
import { AppError } from "../../../shared/errors/app-error.js";

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

  router.post(
    "/enquiry",
    balanceguardSite(async (ctx, req) => {
      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        throw new AppError({
          code: "VALIDATION_FAILED",
          status: 400,
          message: "Invalid JSON body",
        });
      }

      const input = validateEnquiryInput(raw);
      const out = await submitEnquiry(input);

      return json(ctx, { lead_id: out.leadId });
    })
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
