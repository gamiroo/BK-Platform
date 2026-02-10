// src/frontend/client/src/views/layout/shell.ts
//
// Client shell: header + footer + nav + theme toggles + logout wiring.
//
// Responsibilities:
// - Provide consistent chrome (header/footer) around page content.
// - Provide mobile menu with focus management + a11y.
// - NEVER perform network calls here.
//   Logout is delegated to opts.onLogout() provided by the app/router layer.

import { mustClass } from "../../../../shared/css-modules.js";
import {
  getThemePreference,
  initTheme,
  nextThemePreference,
  setThemePreference,
} from "../../../../shared/theme.js";
import { el } from "../../shared/dom.js";
import styles from "./shell.module.css";

type ThemePref = "system" | "dark" | "light";

// Local UI event for re-rendering theme buttons when preference changes.
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

  // Keep the handler sync; state changes happen instantly.
  btn.addEventListener("click", () => {
    setThemePreference(nextThemePreference(getThemePreference()));
    window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
  });

  // Update when theme changes from elsewhere too.
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

  // Overlay sits outside header so it can cover the whole viewport.
  const overlay = el("div", {
    class: mustClass(styles, "menuOverlay"),
    "aria-hidden": "true",
  }) as HTMLDivElement;

  const panel = el("div", {
    class: mustClass(styles, "menuPanel"),
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Client menu",
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

  const nav = el(
    "nav",
    { class: mustClass(styles, "menuNav"), "aria-label": "Client navigation" },
    el("a", { class: mustClass(styles, "menuLink"), href: "/client/dashboard" }, "Dashboard"),
    el("a", { class: mustClass(styles, "menuLink"), href: "/client/orders" }, "Orders (soon)"),
    el("a", { class: mustClass(styles, "menuLink"), href: "/client/deliveries" }, "Deliveries (soon)"),
    el("a", { class: mustClass(styles, "menuLink"), href: "/client/profile" }, "Profile (soon)")
  );

  const body = el(
    "div",
    { class: mustClass(styles, "menuBody") },
    nav,
    themeRow,
    el("div", { class: mustClass(styles, "menuRow") }, logoutBtn)
  );

  panel.append(menuHeader, body);
  overlay.append(panel);

  // Simple focus restore so keyboard users return to where they were.
  let lastFocus: HTMLElement | null = null;

  const isOpen = (): boolean => overlay.getAttribute("data-open") === "true";

  const open = (): void => {
    if (isOpen()) return;

    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    overlay.setAttribute("data-open", "true");
    overlay.setAttribute("aria-hidden", "false");
    burger.setAttribute("aria-expanded", "true");

    // Prevent background scroll while menu is open.
    document.documentElement.classList.add(mustClass(styles, "noScroll"));

    // Focus first nav link, else close button.
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

  // Click outside the panel closes it.
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  // Escape closes it.
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) close();
  });

  // Logout from menu:
  // - Close menu immediately for UI responsiveness
  // - Delegate actual logout behavior to app layer
  logoutBtn.addEventListener("click", () => {
    close();
    opts.onLogout();
  });

  return { burger, overlay };
}

export function renderClientShell(content: HTMLElement, opts: Readonly<{ onLogout: () => void }>): HTMLElement {
  // Theme must be initialized once per surface bootstrap.
  initTheme();

  const root = document.createElement("div");
  root.className = mustClass(styles, "shell");

  // A11y: skip link for keyboard users.
  const skip = el("a", { class: mustClass(styles, "skip"), href: "#main" }, "Skip to content");

  const brand = el(
    "a",
    { class: mustClass(styles, "brand"), href: "/client/dashboard" },
    "Balance Kitchen",
    el("span", { class: mustClass(styles, "surfaceLabel") }, "Client")
  );

  // Header logout button (desktop).
  // IMPORTANT: keep handler sync; the app layer may launch async work.
  const logout = el(
    "button",
    { class: mustClass(styles, "logout"), type: "button" },
    "Log out"
  ) as HTMLButtonElement;
  logout.addEventListener("click", () => opts.onLogout());

  // Mobile menu has its own theme toggle.
  const menuTheme = createThemeToggle(mustClass(styles, "themeToggleMenu"));
  const mobileMenu = createMobileMenu({ themeToggle: menuTheme, onLogout: opts.onLogout });

  const headerRight = el(
    "div",
    { class: mustClass(styles, "headerRight") },
    mobileMenu.burger,
    logout
  );

  const header = el("header", { class: mustClass(styles, "header") }, skip, brand, headerRight);

  const main = el("main", { class: mustClass(styles, "main"), id: "main" }, content);

  // Footer theme toggle (right side).
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
        el("div", { class: mustClass(styles, "footerMuted") }, "Client dashboard • Brisbane, Australia")
      ),

      el(
        "div",
        { class: mustClass(styles, "footerMid") },
        el(
          "nav",
          { class: mustClass(styles, "footerNav"), "aria-label": "Footer" },
          el("a", { class: mustClass(styles, "footerLink"), href: "/client/dashboard" }, "Dashboard"),
          el("a", { class: mustClass(styles, "footerLink"), href: "/privacy" }, "Privacy"),
          el("a", { class: mustClass(styles, "footerLink"), href: "/terms" }, "Terms")
        ),
        el("div", { class: mustClass(styles, "footerCopy") }, "© ", String(new Date().getFullYear()), " Balance Kitchen")
      ),

      el("div", { class: mustClass(styles, "footerRight") }, footerTheme)
    )
  );

  // Ensure toggles render correct initial icon/labels.
  window.dispatchEvent(new Event(THEME_CHANGED_EVENT));

  root.append(header, mobileMenu.overlay, main, footer);
  return root;
}
