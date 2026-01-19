// api/site.ts
/**
 * Vercel Function entrypoint: Site surface API.
 *
 * Routes registered under site surface MUST be BalanceGuard-wrapped
 * with `surface: "site"` in their route module.
 */

import { makeVercelHandler } from "../src/server/http/vercel-app.js";

export const config = { runtime: "nodejs" };

export default makeVercelHandler("site");


