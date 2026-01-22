import { el } from "../../shared/dom.js";
import { renderShell } from "../layout/shell.js";

export function renderNotFoundPage(root: HTMLElement): void {
  const content = el(
    "div",
    {},
    el("h1", {}, "Not found"),
    el("p", {}, "This page doesn’t exist."),
    el("a", { href: "/" }, "Go home")
  );

  root.append(renderShell(content));
}
