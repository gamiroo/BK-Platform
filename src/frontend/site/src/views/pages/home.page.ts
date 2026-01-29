import { mustClass } from "../../../../shared/css-modules.js";
import { el } from "../../shared/dom.js";
import { renderShell } from "../layout/shell.js";
import { LOCALE_CHANGED_EVENT, t } from "../../../../shared/il8n.js";
import styles from "./home.module.css";

export function renderHomePage(root: HTMLElement): void {
  const title = el("h1", { class: mustClass(styles, "h1") }, "Balance Kitchen") as HTMLHeadingElement;

  const lede = el(
    "p",
    { class: mustClass(styles, "lede") },
    t("home.lede")
  ) as HTMLParagraphElement;

  const cta = el("a", { class: mustClass(styles, "cta"), href: "/request-access" }, t("home.cta")) as HTMLAnchorElement;

  const hero = el(
    "section",
    { class: mustClass(styles, "hero") },
    title,
    lede,
    el("div", { class: mustClass(styles, "ctaRow") }, cta)
  );

  const refresh = (): void => {
    lede.textContent = t("home.lede");
    cta.textContent = t("home.cta");
  };

  window.addEventListener(LOCALE_CHANGED_EVENT, refresh);

  const content = el("div", { class: mustClass(styles, "stack") }, hero);
  root.append(renderShell(content));
}
