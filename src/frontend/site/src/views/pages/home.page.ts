import { mustClass } from "@/frontend/shared/css-modules.js";
import { el } from "../../shared/dom.js";
import { renderShell } from "../layout/shell.js";
import styles from "./home.module.css";

export function renderHomePage(root: HTMLElement): void {
  const hero = el(
    "section",
    { class: mustClass(styles, "hero") },
    el("h1", { class: mustClass(styles, "h1") }, "Balance Kitchen"),
    el(
      "p",
      { class: mustClass(styles, "lede") },
      "Brisbane meal prep, built around a relationship-led onboarding and a preset-driven weekly ordering loop."
    ),
    el(
      "div",
      { class: mustClass(styles, "ctaRow") },
      el("a", { class: mustClass(styles, "cta"), href: "/request-access" }, "Request Access")
    )
  );

  const content = el("div", { class: mustClass(styles, "stack") }, hero);
  root.append(renderShell(content));
}
