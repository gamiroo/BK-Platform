// src/frontend/admin/src/app.ts
// Admin surface application bootstrapper
import { startRouter, type Route } from "./router/router.js";
import { el, clear } from "./shared/dom.js";

import { renderAdminShell } from "./views/layout/shell.js";
import { renderAdminLoginPage } from "./views/pages/login.page.js";
import { renderAdminDashboardPage } from "./views/pages/dashboard.page.js";
import { renderAdminNotFoundPage } from "./views/pages/not-found.page.js";

type MeResponse = Readonly<
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "unavailable" }
>;

async function adminMe(): Promise<MeResponse> {
  try {
    const res = await fetch("/api/admin/auth/me", { method: "GET" });
    if (!res.ok) return { ok: false, reason: "unauthenticated" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

function navigate(path: string): void {
  window.history.replaceState({}, "", path);
}

export function startAdminApp(root: HTMLElement): void {
  // Simple boot screen (prevents flicker while deciding route)
  const boot = el(
    "div",
    { style: "padding: 20px; opacity: 0.85;" },
    "Loading…"
  );
  root.append(boot);

  void (async () => {
    const me = await adminMe();

    // Decide initial route deterministically.
    // If server unavailable, we still land on login (safe).
    if (me.ok) navigate("/admin/dashboard");
    else navigate("/admin/login");

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

    // Wrap pages in the Admin shell (surface-scoped)
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
