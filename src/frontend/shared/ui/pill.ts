import { mustClass } from "../css-modules.js";
import { h } from "./dom.js";
import styles from "./pill.module.css";

export type UiPillTone = "neutral" | "accent";

export function uiPill(opts: Readonly<{ text: string; tone?: UiPillTone }>): HTMLElement {
  const tone = opts.tone ?? "neutral";
  return h("span", { class: `${mustClass(styles, "pill")} ${mustClass(styles, tone)}`.trim() }, opts.text);
}
