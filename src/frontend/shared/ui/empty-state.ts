import { mustClass } from "../css-modules.js";
import { h } from "./dom.js";
import styles from "./empty-state.module.css";

export function uiEmptyState(opts: Readonly<{ title: string; body: string; icon?: string }>): HTMLElement {
  return h(
    "div",
    { class: mustClass(styles, "wrap") },
    h("div", { class: mustClass(styles, "icon"), "aria-hidden": "true" }, opts.icon ?? "⧗"),
    h("div", { class: mustClass(styles, "title") }, opts.title),
    h("div", { class: mustClass(styles, "body") }, opts.body)
  );
}
