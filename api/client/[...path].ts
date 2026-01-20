// api/client/[...path].ts
/**
 * Catch-all Vercel Function for the Client surface.
 *
 * Why:
 * - Vercel functions are file-based. `api/client.ts` only matches `/api/client`.
 * - This file matches `/api/client/*` (e.g. /api/client/health).
 *
 * We normalize `/api/client/<anything>` -> `/<anything>` before routing into the app router.
 */



import { makeVercelHandler } from "../../src/server/http/vercel-app.js";

const handler = makeVercelHandler("client");

export default {
  async fetch(request: Request): Promise<Response> {
    return handler(request);
  },
};
