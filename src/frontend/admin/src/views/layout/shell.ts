import { mustClass } from "../../../../../frontend/shared/css-modules.js";
import {
  getThemePreference,
  initTheme,
  nextThemePreference,
  setThemePreference,
} from "../../../../shared/theme.js";
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

function createThemeToggle(extraClass: string): HTMLButtonElement {
  const btn = el("button", {
    type: "button",
    class: `${mustClass(styles, "themeToggle")} ${extraClass}`.trim(),
    "aria-label": "Theme",
    title: "Theme",
  }) as HTMLButtonElement;

  const refresh = (): void => {
    const pref = getThemePreference();
    btn.textContent = themeIcon(pref);
    btn.setAttribute("data-theme-pref", pref);
    btn.setAttribute("aria-label", themeLabel(pref));
    btn.title = themeLabel(pref);
  };

  btn.addEventListener("click", () => {
    setThemePreference(nextThemePreference(getThemePreference()));
    window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
  });

  window.addEventListener(THEME_CHANGED_EVENT, refresh);
  refresh();
  return btn;
}

type MobileMenu = Readonly<{
  burger: HTMLButtonElement;
  overlay: HTMLDivElement;
}>;

function createMobileMenu(opts: Readonly<{ themeToggle: HTMLButtonElement; onLogout: () => void }>): MobileMenu {
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
    "aria-label": "Admin menu",
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

  const menuHeader = el(
    "div",
    { class: mustClass(styles, "menuHeader") },
    el("div", { class: mustClass(styles, "menuTitle") }, "Menu"),
    closeBtn
  );

  const logoutBtn = el(
    "button",
    { type: "button", class: mustClass(styles, "menuAction"), "aria-label": "Log out" },
    "Log out"
  ) as HTMLButtonElement;

  const themeRow = el(
    "div",
    { class: mustClass(styles, "menuRow") },
    el("div", { class: mustClass(styles, "menuRowLabel") }, "Theme"),
    opts.themeToggle
  );

  const body = el(
    "div",
    { class: mustClass(styles, "menuBody") },
    el(
      "nav",
      { class: mustClass(styles, "menuNav"), "aria-label": "Admin navigation" },
      el("a", { class: mustClass(styles, "menuLink"), href: "/admin/dashboard" }, "Dashboard"),
      el("a", { class: mustClass(styles, "menuLink"), href: "/admin/orders" }, "Orders (soon)"),
      el("a", { class: mustClass(styles, "menuLink"), href: "/admin/customers" }, "Customers (soon)"),
      el("a", { class: mustClass(styles, "menuLink"), href: "/admin/settings" }, "Settings (soon)")
    ),
    themeRow,
    el("div", { class: mustClass(styles, "menuRow") }, logoutBtn)
  );

  panel.append(menuHeader, body);
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

    const firstLink = panel.querySelector("a");
    if (firstLink instanceof HTMLAnchorElement) firstLink.focus();
    else closeBtn.focus();
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
    if (e.key === "Escape" && isOpen()) close();
  });

  logoutBtn.addEventListener("click", () => {
    close();
    opts.onLogout();
  });

  return { burger, overlay };
}

export function renderAdminShell(content: HTMLElement, opts: Readonly<{ onLogout: () => void }>): HTMLElement {
  initTheme();

  const root = document.createElement("div");
  root.className = mustClass(styles, "shell");

  const skip = el("a", { class: mustClass(styles, "skip"), href: "#main" }, "Skip to content");

  const brand = el(
    "a",
    { class: mustClass(styles, "brand"), href: "/admin/dashboard" },
    "Balance Kitchen",
    el("span", { class: mustClass(styles, "surfaceLabel") }, "Admin")
  );

  // Desktop logout (CSS hides on mobile)
  const logout = el("button", { class: mustClass(styles, "logout"), type: "button" }, "Log out") as HTMLButtonElement;
  logout.addEventListener("click", () => opts.onLogout());

  const menuTheme = createThemeToggle(mustClass(styles, "themeToggleMenu"));
  const mobileMenu = createMobileMenu({ themeToggle: menuTheme, onLogout: opts.onLogout });

  const headerRight = el("div", { class: mustClass(styles, "headerRight") }, mobileMenu.burger, logout);
  const header = el("header", { class: mustClass(styles, "header") }, skip, brand, headerRight);

  const main = el("main", { class: mustClass(styles, "main"), id: "main" }, content);

  const footerTheme = createThemeToggle(mustClass(styles, "themeToggleFooter"));

  const footer = el(
    "footer",
    { class: mustClass(styles, "footer") },
    el(
      "div",
      { class: mustClass(styles, "footerInner") },
      el(
        "div",
        { class: mustClass(styles, "footerLeft") },
        el("div", { class: mustClass(styles, "footerBrand") }, "Balance Kitchen"),
        el("div", { class: mustClass(styles, "footerMuted") }, "Admin console • Brisbane, Australia")
      ),
      el(
        "div",
        { class: mustClass(styles, "footerMid") },
        el(
          "nav",
          { class: mustClass(styles, "footerNav"), "aria-label": "Footer" },
          el("a", { class: mustClass(styles, "footerLink"), href: "/admin/dashboard" }, "Dashboard"),
          el("a", { class: mustClass(styles, "footerLink"), href: "/privacy" }, "Privacy"),
          el("a", { class: mustClass(styles, "footerLink"), href: "/terms" }, "Terms")
        ),
        el("div", { class: mustClass(styles, "footerCopy") }, "© ", String(new Date().getFullYear()), " Balance Kitchen")
      ),
      el("div", { class: mustClass(styles, "footerRight") }, footerTheme)
    )
  );

  window.dispatchEvent(new Event(THEME_CHANGED_EVENT));

  root.append(header, mobileMenu.overlay, main, footer);
  return root;
}
