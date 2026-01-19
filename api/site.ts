// api/site.ts
/**
 * Vercel Function entrypoint: Site surface API.
 *
 * Routes registered under site surface MUST be BalanceGuard-wrapped
 * with `surface: "site"` in their route module.
 */;
export const config = { runtime: "nodejs" };

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  url.pathname = "/api/site/health";
  return Response.redirect(url.toString(), 307);
}

