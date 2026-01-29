import { mustClass } from "../css-modules.js";
import { h } from "./dom.js";
import styles from "./badge.module.css";

export type UiBadgeTone = "success" | "warn" | "danger" | "info";

export function uiBadge(opts: Readonly<{ text: string; tone: UiBadgeTone }>): HTMLElement {
  return h("span", { class: `${mustClass(styles, "badge")} ${mustClass(styles, opts.tone)}`.trim() }, opts.text);
}
