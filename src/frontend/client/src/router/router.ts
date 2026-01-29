type RenderFn = (path: string) => void;

export type Router = Readonly<{
  start: () => void;
  go: (path: string) => void;
}>;

function sameOriginPath(v: string): string | null {
  try {
    // Support absolute + relative
    const u = new URL(v, window.location.origin);
    if (u.origin !== window.location.origin) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

export function createRouter(root: HTMLElement, render: RenderFn): Router {
  const onClick = (e: MouseEvent): void => {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const target = e.target instanceof Element ? e.target : null;
    const a = target ? target.closest("a") : null;
    if (!a) return;

    const href = a.getAttribute("href");
    if (!href) return;

    const path = sameOriginPath(href);
    if (!path) return;

    // Only intercept client surface routes
    if (!path.startsWith("/client")) return;

    e.preventDefault();
    window.history.pushState({}, "", path);
    render(window.location.pathname);
  };

  const onPop = (): void => {
    render(window.location.pathname);
  };

  const start = (): void => {
    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPop);
    render(window.location.pathname);
  };

  const go = (path: string): void => {
    window.history.pushState({}, "", path);
    render(window.location.pathname);
  };

  return { start, go };
}
