import { mustClass } from "../css-modules.js";
import { h } from "./dom.js";
import styles from "./skeleton.module.css";

export function uiSkeletonLine(opts: Readonly<{ width?: string }>): HTMLElement {
  const width = opts.width ?? "100%";
  return h("div", { class: mustClass(styles, "line"), style: `width:${width}` });
}
