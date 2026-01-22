// src/frontend/site/src/views/layout/shell.ts
import { mustClass } from "../../../../../frontend/shared/css-modules.js";
import { el } from "../../shared/dom.js";
import styles from "./shell.module.css";

export function renderShell(content: HTMLElement): HTMLElement {
  const header = el(
    "header",
    { class: mustClass(styles, "header") },
    el("a", { class: mustClass(styles, "brand"), href: "/" }, "Balance Kitchen"),
    el(
      "nav",
      { class: mustClass(styles, "nav") },
      el("a", { class: mustClass(styles, "link"), href: "/request-access" }, "Request Access")
    )
  );

  const main = el("main", { class: mustClass(styles, "main") }, content); 
  const footer = el(
    "footer",
    { class: mustClass(styles, "footer") },
    el("span", {}, "© ", String(new Date().getFullYear()), " Balance Kitchen")
  );

  return el("div", { class: mustClass(styles, "shell") }, header, main, footer);
}
