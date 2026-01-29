// src/frontend/admin/src/app.ts
// Admin surface application bootstrapper
//
// Purpose:
// - Decide the initial route deterministically without UI flicker.
// - Gate the Admin surface using /api/admin/auth/me.
// - NEVER call the browser network API directly.
//   All HTTP must flow through src/frontend/lib/http-client.ts.
//
// Why this matters:
// - Prevents "request drift" (credentials, headers, envelopes).
// - Keeps error semantics stable across all frontends.
// - Ensures consistent observability (request_id) in dev logs.

import { startRouter, type Route } from "./router/router.js";
import { el, clear } from "./shared/dom.js";

import { renderAdminShell } from "./views/layout/shell.js";
import { renderAdminLoginPage } from "./views/pages/login.page.js";
import { renderAdminDashboardPage } from "./views/pages/dashboard.page.js";
import { renderAdminNotFoundPage } from "./views/pages/not-found.page.js";

import { httpGet } from "../../lib/http-client.js";

type MeResponse = Readonly<
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "unavailable" }
>;

/**
 * Minimal "me" probe for boot routing.
 *
 * Contract:
 * - Never throws (we treat all failures as data).
 * - "unauthenticated" means: server reachable but user has no valid admin session.
 * - "unavailable" means: network/response failure (server down, CORS, etc.).
 *
 * Notes:
 * - We do NOT use expectOk() here on purpose. Boot routing is clearer when we
 *   branch on the union result rather than throw/catch.
 * - /api/admin/auth/me is expected to return the canonical envelope:
 *   Success: { ok:true, request_id, data: ... }
 *   Error:   { ok:false, request_id, error:{ code, message } }
 */
async function adminMe(): Promise<MeResponse> {
  const r = await httpGet<unknown>("/api/admin/auth/me");

  if (r.ok) {
    return { ok: true };
  }

  // http-client normalizes these local failures into stable error codes.
  // Treat them as "unavailable" so we land on login safely (no crash).
  if (r.error.code === "NETWORK_ERROR" || r.error.code === "INVALID_RESPONSE") {
    return { ok: false, reason: "unavailable" };
  }

  // Any other failure is treated as an auth miss:
  // - UNAUTHENTICATED / FORBIDDEN / WRONG_SURFACE etc.
  return { ok: false, reason: "unauthenticated" };
}

/**
 * Deterministic navigation helper.
 * We use replaceState to avoid a back-button loop (boot -> login -> boot).
 */
function navigate(path: string): void {
  window.history.replaceState({}, "", path);
}

export function startAdminApp(root: HTMLElement): void {
  // Simple boot screen (prevents flicker while deciding route)
  const boot = el("div", { style: "padding: 20px; opacity: 0.85;" }, "Loading…");
  root.append(boot);

  // We deliberately start async work without making startAdminApp async.
  // This avoids "no-misused-promises" patterns and keeps the bootstrap deterministic.
  void (async () => {
    const me = await adminMe();

    // Decide initial route deterministically.
    // If the server is unavailable, we still land on login (safe + calm).
    if (me.ok) navigate("/admin/dashboard");
    else navigate("/admin/login");

    // Replace boot screen with routed content.
    clear(root);

    const routes: readonly Route[] = [
      {
        path: "/admin/login",
        render: (r) => renderAdminLoginPage(r),
      },
      {
        path: "/admin/dashboard",
        render: (r) => renderAdminDashboardPage(r),
      },
      {
        path: "/admin/not-found",
        render: (r) => renderAdminNotFoundPage(r),
      },
    ];

    // Wrap pages in the Admin shell (surface-scoped).
    // We create a per-route content root so the shell can control layout
    // while each page remains isolated and testable.
    startRouter({
      root,
      routes: routes.map((rt) => ({
        ...rt,
        render: (r) => {
          const contentRoot = document.createElement("div");
          rt.render(contentRoot);

          const shell = renderAdminShell(contentRoot);
          r.append(shell);
        },
      })),
    });
  })();
}
