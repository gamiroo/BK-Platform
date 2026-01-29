import { clear } from "../shared/dom.js";

export type Route = Readonly<{
  path: string;
  render: (root: HTMLElement) => void;
}>;

function normalizePath(p: string): string {
  if (!p.startsWith("/")) return `/${p}`;
  return p;
}

export function startRouter(opts: Readonly<{ root: HTMLElement; routes: readonly Route[] }>): void {
  const routes = opts.routes.map((r) => ({ ...r, path: normalizePath(r.path) }));

  const match = (pathname: string): Route | null => {
    const p = normalizePath(pathname);
    const found = routes.find((r) => r.path === p);
    return found ?? null;
  };

  const render = (): void => {
    const url = new URL(window.location.href);
    const route = match(url.pathname) ?? match("/admin/not-found") ?? null;

    clear(opts.root);
    if (!route) return;

    route.render(opts.root);
  };

  document.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    const a = target.closest("a[href]");
    if (!a) return;

    const href = a.getAttribute("href");
    if (!href) return;
    if (href.startsWith("http://") || href.startsWith("https://")) return;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return;

    // Only intercept same-origin internal routes
    const next = new URL(href, window.location.origin);
    if (next.origin !== window.location.origin) return;

    e.preventDefault();
    window.history.pushState({}, "", next.pathname + next.search + next.hash);
    render();
  });

  window.addEventListener("popstate", render);
  render();
}
