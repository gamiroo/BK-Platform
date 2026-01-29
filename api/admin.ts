// api/admin.ts
/**
 * Vercel Function entrypoint: Admin surface API (root).
 * Matches: /api/admin
 *
 * IMPORTANT:
 * Vercel expects Web Handler format: `export default { fetch() {} }`.
 */
import { makeVercelHandler } from "../src/server/http/vercel-app.js";

const handler = makeVercelHandler("admin");

export default {
  async fetch(request: Request): Promise<Response> {
    return handler(request);
  },
};

