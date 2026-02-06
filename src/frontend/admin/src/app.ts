// src/frontend/admin/src/app.ts
//
// Admin surface bootstrapper with 3-state auth gate.
// Supports BOTH deployments:
// - shared host:   /admin/login, /admin/dashboard
// - admin domain:  /login, /dashboard   (e.g. admin.localtest.me)

import { el, clear } from "./shared/dom.js";
import { httpGet, httpPost, expectOk, HttpClientError } from "../../lib/http-client.js";

import { renderAdminLoginPage } from "./views/pages/login.page.js";
import { renderAdminDashboardPage } from "./views/pages/dashboard.page.js";
import { renderAdminNotFoundPage } from "./views/pages/not-found.page.js";

/**
 * Route base detection:
 * - If hostname starts with "admin." => mount at "/"
 * - Else => assume shared-host mount at "/admin"
 */
function adminBasePath(): "" | "/admin" {
  const h = window.location.hostname.toLowerCase();
  return h.startsWith("admin.") ? "" : "/admin";
}

type Page = "login" | "dashboard";

function pagePath(base: "" | "/admin", page: Page): string {
  if (base === "") return page === "login" ? "/login" : "/dashboard";
  return page === "login" ? "/admin/login" : "/admin/dashboard";
}

function parsePage(base: "" | "/admin", pathname: string): Page | "not-found" {
  const login = pagePath(base, "login");
  const dash = pagePath(base, "dashboard");

  // Normalize base root → login
  if (base === "" && (pathname === "/" || pathname === "")) return "login";
  if (base === "/admin" && (pathname === "/admin" || pathname === "/admin/")) return "login";

  if (pathname === login) return "login";
  if (pathname === dash) return "dashboard";

  return "not-found";
}

type BootAuth =
  | Readonly<{ state: "authed" }>
  | Readonly<{ state: "unauthed"; reason: "unauthenticated" | "unavailable" }>;

/** Boot probe: /api/admin/auth/me */
async function adminMe(): Promise<BootAuth> {
  const r = await httpGet<unknown>("/api/admin/auth/me");

  if (r.ok) return { state: "authed" };

  if (r.error.code === "NETWORK_ERROR" || r.error.code === "INVALID_RESPONSE") {
    return { state: "unauthed", reason: "unavailable" };
  }

  return { state: "unauthed", reason: "unauthenticated" };
}

/** Logout: /api/admin/auth/logout (best-effort) */
async function adminLogout(): Promise<void> {
  try {
    expectOk(await httpPost<Readonly<Record<string, never>>>("/api/admin/auth/logout", {}));
  } catch (err: unknown) {
    if (err instanceof HttpClientError) return;
    // eslint-disable-next-line no-console
    console.error("[admin-logout] unexpected error", err);
  }
}

function setPath(path: string, push: boolean): void {
  if (push) window.history.pushState({}, "", path);
  else window.history.replaceState({}, "", path);
}

export function startAdminApp(root: HTMLElement): void {
  const boot = el("div", { style: "padding: 20px; opacity: 0.85;" }, "Loading…");
  root.append(boot);

  void (async () => {
    const base = adminBasePath();

    // Determine auth once
    const bootAuth = await adminMe();
    let authed = bootAuth.state === "authed";

    // Deterministic initial route
    const initial = authed ? pagePath(base, "dashboard") : pagePath(base, "login");
    if (window.location.pathname !== initial) setPath(initial, false);

    clear(root);

    const render = (): void => {
      const page = parsePage(base, window.location.pathname);

      if (page === "not-found") {
        root.replaceChildren();
        renderAdminNotFoundPage(root);
        return;
      }

      // Gate: unauthed => login only
      if (!authed && page !== "login") {
        setPath(pagePath(base, "login"), false);
        render();
        return;
      }

      // Gate: authed => dashboard only
      if (authed && page === "login") {
        setPath(pagePath(base, "dashboard"), false);
        render();
        return;
      }

      root.replaceChildren();

      if (page === "login") {
        renderAdminLoginPage(root, {
          onLoggedIn: () => {
            authed = true;
            setPath(pagePath(base, "dashboard"), true);
            render();
          },
        });
        return;
      }

      renderAdminDashboardPage(root, {
        onLogout: () => {
          void (async () => {
            await adminLogout();
            authed = false;
            setPath(pagePath(base, "login"), true);
            render();
          })();
        },
      });
    };

    window.addEventListener("popstate", () => render());
    render();
  })();
}
