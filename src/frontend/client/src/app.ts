import { initTheme } from "../../shared/theme.js";
import { createRouter } from "./router/router.js";
import { renderClientLoginPage } from "./views/pages/login.page.js";
import { renderClientDashboardPage } from "./views/pages/dashboard.page.js";
import { renderClientNotFoundPage } from "./views/pages/not-found.page.js";

type Route = "/client/login" | "/client/dashboard";

function isRoute(v: string): v is Route {
  return v === "/client/login" || v === "/client/dashboard";
}

/**
 * Scaffold auth gate:
 * - In v1 scaffold we keep it deterministic and non-flickery:
 *   if you hit /client/* we decide synchronously what to render.
 *
 * Replace this later with a real /api/client/auth/me bootstrap.
 */
function isAuthedPlaceholder(): boolean {
  // Later: read cookie-backed session via /me.
  // For now: always render login unless path is explicitly dashboard (dev convenience).
  return window.location.pathname === "/client/dashboard";
}

export function startClientApp(root: HTMLElement): void {
  initTheme();

  const router = createRouter(root, (path) => {
    if (!path.startsWith("/client")) {
      renderClientNotFoundPage(root);
      return;
    }

    if (path === "/client" || path === "/client/") {
      router.go("/client/login");
      return;
    }

    if (!isRoute(path)) {
      renderClientNotFoundPage(root);
      return;
    }

    // Simple gate
    const authed = isAuthedPlaceholder();
    if (!authed && path !== "/client/login") {
      router.go("/client/login");
      return;
    }
    if (authed && path === "/client/login") {
      router.go("/client/dashboard");
      return;
    }

    if (path === "/client/login") {
      renderClientLoginPage(root, {
        onLoggedIn: () => router.go("/client/dashboard"),
      });
      return;
    }

    renderClientDashboardPage(root, {
      onLogout: () => router.go("/client/login"),
    });
  });

  router.start();
}
