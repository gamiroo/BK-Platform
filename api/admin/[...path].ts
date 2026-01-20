// api/admin/[...path].ts
/**
 * Catch-all Vercel Function for the Admin surface.
 *
 * Why:
 * - Vercel functions are file-based. `api/admin.ts` only matches `/api/admin`.
 * - This file matches `/api/admin/*` (e.g. /api/admin/health).
 *
 * We normalize `/api/admin/<anything>` -> `/<anything>` before routing into the app router.
 */



import { makeVercelHandler } from "../../src/server/http/vercel-app.js";

const handler = makeVercelHandler("admin");

export default {
  async fetch(request: Request): Promise<Response> {
    return handler(request);
  },
};
