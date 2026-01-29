import { mustClass } from "../../../../../frontend/shared/css-modules.js";
import { el } from "../../shared/dom.js";
import styles from "./not-found.module.css";

export function renderAdminNotFoundPage(root: HTMLElement): void {
  root.append(
    el(
      "div",
      { class: mustClass(styles, "page") },
      el("h1", { class: mustClass(styles, "h1") }, "Not found"),
      el("p", { class: mustClass(styles, "p") }, "That admin page doesn’t exist yet."),
      el("a", { class: mustClass(styles, "link"), href: "/admin/dashboard" }, "Back to dashboard →")
    )
  );
}
