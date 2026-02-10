import { getAuthState, subscribeAuth } from "./auth-store";

export function AuthGate(
  opts: {
    whenAuthenticated: () => HTMLElement;
    whenUnauthenticated: () => HTMLElement;
    whenLoading?: () => HTMLElement;
  }
) {
  const root = document.createElement("div");

  function render() {
    root.innerHTML = "";
    const state = getAuthState();

    if (state.status === "loading") {
      root.append(opts.whenLoading?.() ?? document.createTextNode(""));
      return;
    }

    if (state.status === "unauthenticated") {
      root.append(opts.whenUnauthenticated());
      return;
    }

    root.append(opts.whenAuthenticated());
  }

  render();
  subscribeAuth(render);
  return root;
}
