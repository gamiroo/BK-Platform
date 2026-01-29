// src/frontend/client/src/app.ts
//
// Client surface bootstrapper.
//
// Goals:
// - Deterministic boot routing (no flicker).
// - Use /api/client/auth/me to decide whether user is authenticated.
// - NEVER call the browser network API directly (no fetch()).
//   All HTTP MUST go through src/frontend/lib/http-client.ts.
//
// Notes about the router style in this surface:
// - This client app uses createRouter() with a callback that decides what to render.
// - We keep that model, but add a boot-time gate so the first render is stable.

import { initTheme } from "../../shared/theme.js";
import { createRouter } from "./router/router.js";
import { renderClientLoginPage } from "./views/pages/login.page.js";
import { renderClientDashboardPage } from "./views/pages/dashboard.page.js";
import { renderClientNotFoundPage } from "./views/pages/not-found.page.js";

import { el, clear } from "./shared/dom.js";
import { httpGet } from "../../lib/http-client.js";

/**
 * Client routes controlled by this surface.
 */
type Route = "/client/login" | "/client/dashboard";

function isRoute(v: string): v is Route {
  return v === "/client/login" || v === "/client/dashboard";
}

/**
 * Auth bootstrap result used by the client router gate.
 *
 * We treat "unavailable" as a server reachability issue (network error, invalid response),
 * but still fall back to /client/login safely.
 */
type BootAuth =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: "unauthenticated" | "unavailable" }>;

/**
 * Probe the authenticated session for the client surface.
 *
 * Contract:
 * - Never throws (returns a union).
 * - "unauthenticated" means: server responded but session is absent/invalid.
 * - "unavailable" means: network issue or invalid response.
 *
 * Why we do NOT use expectOk() here:
 * - Boot logic is clearer when it branches on a union rather than throw/catch.
 * - We still rely on http-client for stable error codes and envelope parsing.
 */
async function clientMe(): Promise<BootAuth> {
  const r = await httpGet<unknown>("/api/client/auth/me");

  if (r.ok) return { ok: true };

  if (r.error.code === "NETWORK_ERROR" || r.error.code === "INVALID_RESPONSE") {
    return { ok: false, reason: "unavailable" };
  }

  // Any other code implies the request reached the server but auth failed
  // (UNAUTHENTICATED, WRONG_SURFACE, FORBIDDEN, etc.).
  return { ok: false, reason: "unauthenticated" };
}

/**
 * Normalizes any /client root hit to a real route.
 */
function normalizeClientEntry(path: string): Route | "not-found" {
  if (!path.startsWith("/client")) return "not-found";
  if (path === "/client" || path === "/client/") return "/client/login";
  if (isRoute(path)) return path;
  return "not-found";
}

export function startClientApp(root: HTMLElement): void {
  initTheme();

  // Boot screen prevents flicker while we determine whether we can go to dashboard.
  const boot = el("div", { style: "padding: 20px; opacity: 0.85;" }, "Loading…");
  root.append(boot);

  void (async () => {
    const me = await clientMe();

    // Decide initial path deterministically:
    // - authed => dashboard
    // - unauth/unavailable => login (safe)
    const initial: Route = me.ok ? "/client/dashboard" : "/client/login";

    // Replace boot screen with router-managed UI.
    clear(root);

    /**
     * Router gate state:
     * - We compute it once at boot for deterministic behavior.
     * - Later, if you want reactive auth (e.g. refresh token), we can extend this.
     */
    const bootAuthed = me.ok;

    const router = createRouter(root, (path) => {
      const normalized = normalizeClientEntry(path);

      if (normalized === "not-found") {
        renderClientNotFoundPage(root);
        return;
      }

      // Enforce the canonical /client entry redirect.
      // router.go() triggers a re-render in your router implementation.
      if (path !== normalized) {
        router.go(normalized);
        return;
      }

      // Gate logic:
      // - If not authed, dashboard is never reachable.
      // - If authed, login is never reachable.
      //
      // This prevents flicker and prevents accidental access to dashboard shell when not authed.
      if (!bootAuthed && normalized !== "/client/login") {
        router.go("/client/login");
        return;
      }

      if (bootAuthed && normalized === "/client/login") {
        router.go("/client/dashboard");
        return;
      }

      // Render routed pages.
      if (normalized === "/client/login") {
        renderClientLoginPage(root, {
          onLoggedIn: () => router.go("/client/dashboard"),
        });
        return;
      }

      renderClientDashboardPage(root, {
        onLogout: () => router.go("/client/login"),
      });
    });

    // Start listening to route changes.
    router.start();

    // Ensure we land on the computed initial route.
    // This replaces the URL deterministically (avoids a visible redirect).
    if (window.location.pathname !== initial) router.go(initial);
  })();
}
