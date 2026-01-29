// api/site.ts
/**
 * Vercel Function entrypoint: Site surface API (root).
 * Matches: /api/site
 *
 * IMPORTANT:
 * Vercel expects Web Handler format: `export default { fetch() {} }`.
 */
import { makeVercelHandler } from "../src/server/http/vercel-app.js";

const handler = makeVercelHandler("site");

export default {
  async fetch(request: Request): Promise<Response> {
    return handler(request);
  },
};



