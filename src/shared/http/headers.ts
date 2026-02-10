// src/shared/http/headers.ts
// Security headers applied to all responses.
// Keep this centralized so BalanceGuard can enforce it consistently.

import { cloneHeadersPreserveSetCookie } from "./clone-headers.js";

export function applySecurityHeaders(res: Response): Response {
  const headers = cloneHeadersPreserveSetCookie(res.headers);

  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "no-referrer");
  headers.set("permissions-policy", "geolocation=(), microphone=(), camera=()");
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set("cross-origin-resource-policy", "same-origin");

  if (process.env.NODE_ENV === "production") {
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  }

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}
