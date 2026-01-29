import { mustClass } from "../css-modules.js";
import { h } from "./dom.js";
import styles from "./section-header.module.css";

export function uiSectionHeader(opts: Readonly<{ title: string; subtitle?: string }>): HTMLElement {
  const sub =
    opts.subtitle && opts.subtitle.trim().length > 0
      ? h("p", { class: mustClass(styles, "subtitle") }, opts.subtitle)
      : null;

  return h(
    "div",
    { class: mustClass(styles, "wrap") },
    h("h1", { class: mustClass(styles, "title") }, opts.title),
    ...(sub ? [sub] : [])
  );
}
