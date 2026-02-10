// src/server/http/routes/site.routes.ts
// Site surface routes (public-facing + infra).
//
// Rules:
// - This file defines real endpoints, so handlers MUST be BalanceGuard-wrapped.
// - Site surface is mostly public: auth usually off.
// - Origin enforcement is route-specific (fail-closed in prod if allowlist missing).

import type { Router } from "../router.js";
import type { RequestContext } from "../../../shared/logging/request-context.js";

import { balanceguardSite } from "../../../shared/security/balanceguard/wrappers.js";
import { applyCorsHeaders } from "../../../shared/http/cors.js";
import { json } from "../../../shared/http/responses.js";

import { AppError } from "../../../shared/errors/app-error.js";
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

// ✅ Webhooks are "site routes" (non-/api) by design.
import { registerWebhookRoutes } from "./webhooks.routes.js";

/**
 * Standard 405 response in your canonical envelope.
 * Keep this helper so we don't hand-roll envelopes in random routes.
 */
function methodNotAllowed(ctx: RequestContext): Response {
  return toHttpErrorResponse(
    ctx,
    normalizeError(
      new AppError({
        code: "METHOD_NOT_ALLOWED",
        status: 405,
        message: "Method not allowed",
      })
    )
  );
}

export function registerSiteRoutes(router: Router): void {
  /**
   * Register webhook endpoints first (explicit grouping).
   *
   * Webhooks should generally:
   * - NOT require Origin/CSRF/auth
   * - be rate-limited separately if needed
   */
  registerWebhookRoutes(router);

  /**
   * Health check:
   * - Confirms server is alive
   * - Confirms DB reachable
   * - Confirms DB env marker matches runtime (BalanceGuard safety invariant)
   */
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

  /**
   * Public enquiry endpoint
   *
   * Notes:
   * - No auth (public marketing form)
   * - No CSRF (no session)
   * - Origin enforced (unsafe POST) — in prod must have allowlist configured
   * - Low rate limit to reduce spam
   */
  router.post(
    "/api/site/enquiry",
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

        // Keep explicit CORS application (even though server.ts also applies security headers)
        // because these are fetch endpoints used by browsers.
        const res = json(ctx, { lead_id: out.leadId });
        return applyCorsHeaders("site", req, res);
      }
    )
  );

  /**
   * If someone hits GET for a POST-only endpoint, return a canonical 405 envelope.
   */
  router.get(
    "/api/site/enquiry",
    balanceguardSite(async (ctx: RequestContext) => methodNotAllowed(ctx))
  );

  /**
   * Root ping:
   * Useful for quick sanity during early dev.
   */
  router.get(
    "/",
    balanceguardSite(async (ctx: RequestContext) => json(ctx, { surface: "site", status: "ok" }))
  );
}
