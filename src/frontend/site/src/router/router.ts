// src/frontend/site/src/router/router.ts
export type Route = Readonly<{
  path: string;
  render: (root: HTMLElement) => void;
}>;

export type Router = Readonly<{
  add: (route: Route) => void;
  start: () => void;
  nav: (path: string) => void;
}>;

function currentPath(): string {
  return window.location.pathname || "/";
}

export function mountRouter(root: HTMLElement): Router {
  const routes: Route[] = [];

  function render(path: string): void {
    const found = routes.find((r) => r.path === path) ?? routes.find((r) => r.path === "/404");
    if (!found) {
      root.textContent = "Route not found.";
      return;
    }

    root.innerHTML = "";
    found.render(root);
  }

  function onLinkClick(e: MouseEvent): void {
    const t = e.target;
    if (!(t instanceof Element)) return;

    const a = t.closest("a");
    if (!a) return;

    const href = a.getAttribute("href");
    if (!href) return;

    // Only intercept same-origin absolute paths
    if (!href.startsWith("/")) return;

    e.preventDefault();
    history.pushState({}, "", href);
    render(currentPath());
  }

  window.addEventListener("popstate", () => render(currentPath()));
  document.addEventListener("click", onLinkClick);

  return {
    add: (route) => {
      routes.push(route);
    },
    start: () => render(currentPath()),
    nav: (path) => {
      history.pushState({}, "", path);
      render(path);
    },
  };
}
