// src/shared/security/balanceguard/ip.ts
// Extract client IP from headers with a safe default.
// NOTE: In production behind Vercel/proxies, you will refine trusted proxy rules.

export function extractIp(req: Request): string {
  // Vercel commonly provides x-forwarded-for.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // x-forwarded-for can be a comma-separated list; first is original client
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  // Fall back (not always available via Fetch Request)
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "0.0.0.0";
}
