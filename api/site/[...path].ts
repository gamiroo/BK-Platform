// api/site/[...path].ts
/**
 * Catch-all Vercel Function for the Site surface.
 *
 * Why:
 * - Vercel functions are file-based. `api/site.ts` only matches `/api/site`.
 * - This file matches `/api/site/*` (e.g. /api/site/health).
 *
 * We normalize `/api/site/<anything>` -> `/<anything>` before routing into the app router.
 */

import { makeVercelHandler } from "../../src/server/http/vercel-app.js";

export const config = { runtime: "nodejs" };

export default makeVercelHandler("site");
