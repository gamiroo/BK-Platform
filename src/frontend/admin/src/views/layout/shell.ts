import { mustClass } from "../../../../../frontend/shared/css-modules.js";
import {
  getThemePreference,
  nextThemePreference,
  setThemePreference,
} from "../../../../../frontend/shared/theme.js";
import { el } from "../../shared/dom.js";
import styles from "./shell.module.css";

type ThemePref = "system" | "dark" | "light";
const THEME_CHANGED_EVENT = "bk_theme_changed";

function themeIcon(pref: ThemePref): string {
  if (pref === "system") return "🖥️";
  if (pref === "dark") return "🌙";
  return "☀️";
}

function themeLabel(pref: ThemePref): string {
  if (pref === "system") return "System theme";
  if (pref === "dark") return "Dark theme";
  return "Light theme";
}

function createThemeToggle(extraClassName: string): HTMLButtonElement {
  const btn = el("button", {
    type: "button",
    class: `${mustClass(styles, "themeToggle")} ${extraClassName}`.trim(),
    "aria-label": "Theme",
  }) as HTMLButtonElement;

  const refresh = (): void => {
    const pref = getThemePreference();
    btn.textContent = themeIcon(pref);
    btn.setAttribute("data-theme-pref", pref);
    btn.title = themeLabel(pref);
    btn.setAttribute("aria-label", themeLabel(pref));
  };

  btn.addEventListener("click", () => {
    const next = nextThemePreference(getThemePreference());
    setThemePreference(next);
    window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
  });

  window.addEventListener(THEME_CHANGED_EVENT, refresh);
  refresh();
  return btn;
}

function createMobileMenu(opts: Readonly<{ themeToggle: HTMLButtonElement }>) {
  const burger = el(
    "button",
    {
      type: "button",
      class: mustClass(styles, "hamburger"),
      "aria-label": "Open menu",
      "aria-expanded": "false",
      title: "Menu",
    },
    "☰"
  ) as HTMLButtonElement;

  const overlay = el("div", {
    class: mustClass(styles, "menuOverlay"),
    "aria-hidden": "true",
  }) as HTMLDivElement;

  const panel = el("div", {
    class: mustClass(styles, "menuPanel"),
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Menu",
  }) as HTMLDivElement;

  const closeBtn = el(
    "button",
    {
      type: "button",
      class: mustClass(styles, "menuClose"),
      "aria-label": "Close menu",
      title: "Close menu",
    },
    "✕"
  ) as HTMLButtonElement;

  const nav = el(
    "nav",
    { class: mustClass(styles, "menuNav"), "aria-label": "Admin menu" },
    el("a", { class: mustClass(styles, "menuLink"), href: "/admin/dashboard" }, "Dashboard"),
    el("a", { class: mustClass(styles, "menuLink"), href: "/admin/clients" }, "Clients"),
    el("a", { class: mustClass(styles, "menuLink"), href: "/admin/orders" }, "Orders"),
    el("a", { class: mustClass(styles, "menuLink"), href: "/admin/menu" }, "Menu"),
    el("a", { class: mustClass(styles, "menuLink"), href: "/admin/settings" }, "Settings")
  );

  const menuHeader = el(
    "div",
    { class: mustClass(styles, "menuHeader") },
    el("div", { class: mustClass(styles, "menuTitle") }, "Admin"),
    closeBtn
  );

  const menuFooter = el(
    "div",
    { class: mustClass(styles, "menuFooter") },
    el("div", { class: mustClass(styles, "menuRow") },
      el("div", { class: mustClass(styles, "menuRowLabel") }, "Theme"),
      opts.themeToggle
    )
  );

  panel.append(menuHeader, nav, menuFooter);
  overlay.append(panel);

  let lastFocus: HTMLElement | null = null;

  const isOpen = (): boolean => overlay.getAttribute("data-open") === "true";

  const open = (): void => {
    if (isOpen()) return;

    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    overlay.setAttribute("data-open", "true");
    overlay.setAttribute("aria-hidden", "false");
    burger.setAttribute("aria-expanded", "true");

    document.documentElement.classList.add(mustClass(styles, "noScroll"));
    closeBtn.focus();
  };

  const close = (): void => {
    if (!isOpen()) return;

    overlay.removeAttribute("data-open");
    overlay.setAttribute("aria-hidden", "true");
    burger.setAttribute("aria-expanded", "false");

    document.documentElement.classList.remove(mustClass(styles, "noScroll"));
    if (lastFocus) lastFocus.focus();
    else burger.focus();
  };

  burger.addEventListener("click", () => {
    if (isOpen()) close();
    else open();
  });

  closeBtn.addEventListener("click", close);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (isOpen()) close();
  });

  return { burger, overlay };
}

export function renderAdminShell(content: HTMLElement): HTMLElement {
  const root = document.createElement("div");
  root.className = mustClass(styles, "shell");

  const skip = el("a", { class: mustClass(styles, "skipLink"), href: "#main" }, "Skip to content");

  const brand = el("a", { class: mustClass(styles, "brand"), href: "/admin/dashboard" }, "Balance Kitchen");
  const surface = el("div", { class: mustClass(styles, "surface") }, "Admin");

  const headerLeft = el("div", { class: mustClass(styles, "headerLeft") }, brand, surface);

  // Header has NO theme toggle.
  const menuTheme = createThemeToggle(mustClass(styles, "themeToggleMenu"));
  const mobileMenu = createMobileMenu({ themeToggle: menuTheme });

  const headerRight = el("div", { class: mustClass(styles, "headerRight") }, mobileMenu.burger);

  const header = el("header", { class: mustClass(styles, "header") }, headerLeft, headerRight);

  const sidebar = el(
    "aside",
    { class: mustClass(styles, "sidebar"), "aria-label": "Admin navigation" },
    el("a", { class: mustClass(styles, "navLink"), href: "/admin/dashboard" }, "Dashboard"),
    el("a", { class: mustClass(styles, "navLink"), href: "/admin/clients" }, "Clients"),
    el("a", { class: mustClass(styles, "navLink"), href: "/admin/orders" }, "Orders"),
    el("a", { class: mustClass(styles, "navLink"), href: "/admin/menu" }, "Menu"),
    el("a", { class: mustClass(styles, "navLink"), href: "/admin/deliveries" }, "Deliveries"),
    el("a", { class: mustClass(styles, "navLink"), href: "/admin/audit" }, "Audit log"),
    el("a", { class: mustClass(styles, "navLink"), href: "/admin/settings" }, "Settings")
  );

  const main = el("main", { class: mustClass(styles, "main"), id: "main" }, content);

  const footerTheme = createThemeToggle(mustClass(styles, "themeToggleFooter"));

  const footer = el(
    "footer",
    { class: mustClass(styles, "footer") },
    el(
      "div",
      { class: mustClass(styles, "footerInner") },
      el(
        "nav",
        { class: mustClass(styles, "footerNav"), "aria-label": "Footer" },
        el("a", { class: mustClass(styles, "footerLink"), href: "/admin/dashboard" }, "Dashboard"),
        el("a", { class: mustClass(styles, "footerLink"), href: "/admin/settings" }, "Settings"),
        el("a", { class: mustClass(styles, "footerLink"), href: "/admin/help" }, "Help")
      ),
      el("div", { class: mustClass(styles, "footerMeta") }, "© ", String(new Date().getFullYear()), " Balance Kitchen"),
      el("div", { class: mustClass(styles, "footerRight") }, footerTheme)
    )
  );

  window.dispatchEvent(new Event(THEME_CHANGED_EVENT));

  const layout = el(
    "div",
    { class: mustClass(styles, "layout") },
    sidebar,
    el("div", { class: mustClass(styles, "contentCol") }, main, footer)
  );

  root.append(skip, header, mobileMenu.overlay, layout);
  return root;
}
