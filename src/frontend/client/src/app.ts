// src/frontend/client/src/app.ts
//
// Client surface bootstrap.
// Responsibilities:
// - Determine initial route deterministically (no flicker).
// - Gate authenticated pages using /api/client/auth/me.
// - Provide login/logout wiring that updates auth state AND performs server actions.
// - NEVER call fetch() directly; use the canonical http client.

import { initTheme } from "../../shared/theme.js";
import { createRouter } from "./router/router.js";
import { renderClientLoginPage } from "./views/pages/login.page.js";
import { renderClientDashboardPage } from "./views/pages/dashboard.page.js";
import { renderClientNotFoundPage } from "./views/pages/not-found.page.js";

import { el, clear } from "./shared/dom.js";
import { httpGet, httpPost, expectOk, HttpClientError } from "../../lib/http-client.js";

type Route = "/client/login" | "/client/dashboard";

function isRoute(v: string): v is Route {
  return v === "/client/login" || v === "/client/dashboard";
}

type BootAuth =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: "unauthenticated" | "unavailable" }>;

/**
 * Boot-time auth check.
 * - We intentionally treat NETWORK/INVALID_RESPONSE as "unavailable"
 *   so we can show login page but with a nicer error later if you want.
 */
async function clientMe(): Promise<BootAuth> {
  const r = await httpGet<unknown>("/api/client/auth/me");

  if (r.ok) return { ok: true };

  if (r.error.code === "NETWORK_ERROR" || r.error.code === "INVALID_RESPONSE") {
    return { ok: false, reason: "unavailable" };
  }

  return { ok: false, reason: "unauthenticated" };
}

function normalizeClientEntry(path: string): Route | "not-found" {
  if (!path.startsWith("/client")) return "not-found";
  if (path === "/client" || path === "/client/") return "/client/login";
  if (isRoute(path)) return path;
  return "not-found";
}

/**
 * Server logout.
 * - MUST be POST so BalanceGuard can enforce CSRF.
 * - Body can be {} (your server ignores it).
 * - http-client will attach x-csrf-token automatically from bk_csrf_client/bk_csrf cookie.
 */
async function clientLogout(): Promise<void> {
  // If the CSRF cookie is missing, this will 403 and we’ll still route to login,
  // but cookies may not clear. In practice, once login sets CSRF correctly, this should succeed.
  expectOk(await httpPost<Record<string, never>>("/api/client/auth/logout", {}));
}

export function startClientApp(root: HTMLElement): void {
  initTheme();

  // Deterministic boot UI.
  const boot = el("div", { style: "padding: 20px; opacity: 0.85;" }, "Loading…");
  root.append(boot);

  void (async () => {
    const me = await clientMe();

    // Mutable auth flag (simple Day-1 approach).
    // If you later adopt auth-store/AuthGate, this becomes setAuthState(...).
    let authed = me.ok;

    const initial: Route = authed ? "/client/dashboard" : "/client/login";

    clear(root);

    const router = createRouter(root, (path) => {
      const normalized = normalizeClientEntry(path);

      if (normalized === "not-found") {
        renderClientNotFoundPage(root);
        return;
      }

      // Normalize /client → /client/login
      if (path !== normalized) {
        router.go(normalized);
        return;
      }

      // Gate: keep routes consistent with auth state.
      if (!authed && normalized !== "/client/login") {
        router.go("/client/login");
        return;
      }

      if (authed && normalized === "/client/login") {
        router.go("/client/dashboard");
        return;
      }

      // --- Render ---
      if (normalized === "/client/login") {
        renderClientLoginPage(root, {
          onLoggedIn: async () => {
            // After login route sets cookies, we can flip state and route.
            authed = true;
            router.go("/client/dashboard");
          },
        });
        return;
      }

      // Dashboard
      renderClientDashboardPage(root, {
        onLogout: () => {
          // IMPORTANT:
          // Event handlers must be sync (eslint no-misused-promises),
          // so we launch async explicitly and return void.
          void (async () => {
            try {
              // Actually tell the server to revoke + clear cookies.
              await clientLogout();
            } catch (err: unknown) {
              // Even if logout fails, we still route to login
              // to prevent the UI from appearing "stuck".
              //
              // But: if this fails consistently, cookies won't clear,
              // and /auth/me may still succeed on refresh.
              if (err instanceof HttpClientError) {
                // eslint-disable-next-line no-console
                console.warn("[client-logout] failed", err.code, err.message);
              } else {
                // eslint-disable-next-line no-console
                console.warn("[client-logout] unexpected failure", err);
              }
            } finally {
              authed = false;
              router.go("/client/login");
            }
          })();
        },
      });
    });

    router.start();

    // Drive first render via go() (NOT router.render)
    router.go(initial);
  })();
}
