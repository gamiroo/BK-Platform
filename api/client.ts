// api/client.ts
/**
 * Vercel Function entrypoint: Client surface API (root).
 * Matches: /api/client
 *
 * IMPORTANT:
 * Vercel expects Web Handler format: `export default { fetch() {} }`.
 */
import { makeVercelHandler } from "../src/server/http/vercel-app.js";

const handler = makeVercelHandler("client");

export default {
  async fetch(request: Request): Promise<Response> {
    return handler(request);
  },
};

