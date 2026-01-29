import { mustClass } from "../../../../../frontend/shared/css-modules.js";
import { uiCard, uiEmptyState, uiSectionHeader } from "../../../../../frontend/shared/ui/index.js";
import { el } from "../../shared/dom.js";
import { renderClientShell } from "../layout/shell.js";

export function renderClientNotFoundPage(root: HTMLElement): void {
  root.replaceChildren();

  const header = uiSectionHeader({
    title: "Not found",
    subtitle: "That page doesn’t exist on the Client surface.",
  });

  const card = uiCard({ title: "404", subtitle: "Client route missing" });
  card.body.append(uiEmptyState({ title: "Page not found", body: "Check the URL or use the menu.", icon: "🧭" }));

  const content = el("div", { class: mustClass({ page: "page" } as const, "page") }, header, card.el);

  root.append(
    renderClientShell(
      el("div", {}, content),
      { onLogout: () => window.location.assign("/client/login") }
    )
  );
}
