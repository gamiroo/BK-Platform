// src/shared/http/headers.ts
// Security headers applied to all responses.
// Keep this centralized so BalanceGuard can enforce it consistently.

export function applySecurityHeaders(res: Response): Response {
  const headers = new Headers(res.headers);

  // Baseline hardening
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "no-referrer");
  headers.set("permissions-policy", "geolocation=(), microphone=(), camera=()");
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set("cross-origin-resource-policy", "same-origin");

  // HSTS only makes sense behind HTTPS (production)
  if (process.env.NODE_ENV === "production") {
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  }

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}
