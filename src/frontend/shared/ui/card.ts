import { mustClass } from "../css-modules.js";
import { h } from "./dom.js";
import styles from "./card.module.css";

export type UiCardTone = "default" | "muted";

export type UiCard = Readonly<{
  el: HTMLElement;
  body: HTMLElement;
}>;

export function uiCard(opts: Readonly<{
  title: string;
  subtitle?: string;
  tone?: UiCardTone;
  actions?: ReadonlyArray<Node>;
  footer?: ReadonlyArray<Node>;
}>): UiCard {
  const tone = opts.tone ?? "default";

  const title = h("h2", { class: mustClass(styles, "title") }, opts.title);
  const sub =
    opts.subtitle && opts.subtitle.trim().length > 0
      ? h("div", { class: mustClass(styles, "subtitle") }, opts.subtitle)
      : null;

  const headerLeft = h(
    "div",
    { class: mustClass(styles, "headerLeft") },
    title,
    ...(sub ? [sub] : [])
  );

  const headerRight =
    opts.actions && opts.actions.length > 0
      ? h("div", { class: mustClass(styles, "headerRight") }, ...opts.actions)
      : null;

  const header = h(
    "div",
    { class: mustClass(styles, "header") },
    headerLeft,
    ...(headerRight ? [headerRight] : [])
  );

  const body = h("div", { class: mustClass(styles, "body") });

  const footer =
    opts.footer && opts.footer.length > 0
      ? h("div", { class: mustClass(styles, "footer") }, ...opts.footer)
      : null;

  const el = h(
    "section",
    { class: `${mustClass(styles, "card")} ${mustClass(styles, tone)}`.trim() },
    header,
    body,
    ...(footer ? [footer] : [])
  );

  return { el, body };
}
