// src/frontend/site/src/views/layout/shell.ts
import { mustClass } from "../../../../../frontend/shared/css-modules.js";
import {
  initTheme,
  getThemePreference,
  nextThemePreference,
  setThemePreference,
} from "../../../../../frontend/shared/theme.js";
import {
  initLocale,
  getLocale,
  nextLocale,
  setLocale,
  LOCALE_CHANGED_EVENT,
  t,
  localeLabel,
  localeShort,
} from "../../../../shared/il8n.js";
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

type ThemeToggle = Readonly<{
  el: HTMLButtonElement;
  refresh: () => void;
}>;

function createThemeToggle(extraClassName: string): ThemeToggle {
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

    // Refresh all toggles (footer + menu)
    window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
  });

  window.addEventListener(THEME_CHANGED_EVENT, refresh);

  refresh();
  return { el: btn, refresh };
}

type MobileMenu = Readonly<{
  burger: HTMLButtonElement;
  overlay: HTMLDivElement;
  open: () => void;
  close: () => void;
}>;

function createMobileMenu(opts: Readonly<{ themeToggle: HTMLButtonElement }>): MobileMenu {
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

  const requestAccess = el(
    "a",
    { class: mustClass(styles, "pillButton"), href: "/request-access", role: "button" },
    t("nav.enquire_now")
  ) as HTMLAnchorElement;

  const menuTitle = el("div", { class: mustClass(styles, "menuTitle") }, t("menu.title"));

  const menuHeader = el(
    "div",
    { class: mustClass(styles, "menuHeader") },
    menuTitle,
    closeBtn
  );

  const themeRowLabel = el("div", { class: mustClass(styles, "menuRowLabel") }, t("menu.theme"));

  const menuBody = el(
    "div",
    { class: mustClass(styles, "menuBody") },
    el("div", { class: mustClass(styles, "menuRow") }, requestAccess),
    el("div", { class: mustClass(styles, "menuRow") }, themeRowLabel, opts.themeToggle)
  );

  // Refresh translatable strings when locale changes
  window.addEventListener(LOCALE_CHANGED_EVENT, () => {
    requestAccess.textContent = t("nav.enquire_now");
    menuTitle.textContent = t("menu.title");
    themeRowLabel.textContent = t("menu.theme");
  });

  panel.append(menuHeader, menuBody);
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

    requestAccess.focus();
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

  return { burger, overlay, open, close };
}

function createFooterLanguageToggle(): HTMLButtonElement {
  const btn = el("button", {
    type: "button",
    class: mustClass(styles, "footerLocaleButton"),
  }) as HTMLButtonElement;

  const label = el("span", { class: mustClass(styles, "footerLocaleLabel") }) as HTMLSpanElement;
  const value = el("span", { class: mustClass(styles, "footerLocaleValue") }) as HTMLSpanElement;

  const refresh = (): void => {
    const loc = getLocale();
    label.textContent = t("footer.language");
    value.textContent = localeShort(loc);
    btn.title = `${t("footer.language")}: ${localeLabel(loc)}`;
    btn.setAttribute("aria-label", `${t("footer.language")}: ${localeLabel(loc)}`);
  };

  btn.append("🌐", label, value);

  btn.addEventListener("click", () => {
    const next = nextLocale(getLocale());
    setLocale(next);
  });

  window.addEventListener(LOCALE_CHANGED_EVENT, refresh);

  refresh();
  return btn;
}

export function renderShell(content: HTMLElement): HTMLElement {
  initTheme();
  initLocale();

  const root = document.createElement("div");
  root.className = mustClass(styles, "shell");

  const bgImg = document.createElement("img");
  bgImg.className = mustClass(styles, "backgroundImage");
  bgImg.src = "/assets/backgrounds/site-background.svg";
  bgImg.alt = "";
  bgImg.decoding = "async";
  bgImg.loading = "eager";
  bgImg.setAttribute("aria-hidden", "true");

  const bg = el("div", { class: mustClass(styles, "background") }, bgImg);

  const logo = document.createElement("img");
  logo.src = "/assets/logo/logo-gold.svg";
  logo.alt = "Balance Kitchen";
  logo.className = mustClass(styles, "logo");
  logo.decoding = "async";
  logo.loading = "eager";

  const brand = el("a", { class: mustClass(styles, "brand"), href: "/" }, logo);

  // Mobile menu controls (theme toggle lives inside the menu panel)
  const menuTheme = createThemeToggle(mustClass(styles, "themeToggleMenu"));
  const mobileMenu = createMobileMenu({ themeToggle: menuTheme.el });

  // Desktop nav (no theme toggle in header anymore)
  const desktopNav = el(
    "nav",
    { class: mustClass(styles, "nav") },
    el(
      "a",
      { class: mustClass(styles, "pillButton"), href: "/request-access", role: "button" },
      t("nav.enquire_now")
    )
  );

  const headerRight = el(
    "div",
    { class: mustClass(styles, "headerRight") },
    mobileMenu.burger,
    desktopNav
  );

  const header = el("header", { class: mustClass(styles, "header") }, brand, headerRight);

  const main = el("main", { class: mustClass(styles, "main") }, content);

  // Footer (theme toggle lives here now)
  const footerTheme = createThemeToggle(mustClass(styles, "themeToggleFooter"));
  const footerLang = createFooterLanguageToggle();

  const footerTagline = el("div", { class: mustClass(styles, "footerTagline") }, t("footer.tagline"));
  const footerLinkRequest = el(
    "a",
    { class: mustClass(styles, "footerLink"), href: "/request-access" },
    t("footer.request_access")
  );
  const footerLinkPrivacy = el("a", { class: mustClass(styles, "footerLink"), href: "/privacy" }, t("footer.privacy"));
  const footerLinkTerms = el("a", { class: mustClass(styles, "footerLink"), href: "/terms" }, t("footer.terms"));

  const year = String(new Date().getFullYear());
  const footerCopyright = el(
    "div",
    { class: mustClass(styles, "footerCopyright") },
    "© ",
    year,
    " Balance Kitchen"
  );

  const footerLocation = el("div", { class: mustClass(styles, "footerMetaMuted") }, t("footer.location"));

  // Live refresh on locale change
  window.addEventListener(LOCALE_CHANGED_EVENT, () => {
    // Header CTA
    (desktopNav.querySelector("a") as HTMLAnchorElement | null)?.replaceChildren(t("nav.enquire_now"));

    // Footer
    footerTagline.textContent = t("footer.tagline");
    footerLinkRequest.textContent = t("footer.request_access");
    footerLinkPrivacy.textContent = t("footer.privacy");
    footerLinkTerms.textContent = t("footer.terms");
    footerLocation.textContent = t("footer.location");
  });

  const footer = el(
    "footer",
    { class: mustClass(styles, "footer") },
    el(
      "div",
      { class: mustClass(styles, "footerInner") },

      // Left: brand + tagline
      el(
        "div",
        { class: mustClass(styles, "footerLeft") },
        el("div", { class: mustClass(styles, "footerBrand") }, "Balance Kitchen"),
        footerTagline
      ),

      // Middle: links + copyright under links
      el(
        "div",
        { class: mustClass(styles, "footerMiddle") },
        el(
          "nav",
          { class: mustClass(styles, "footerNav"), "aria-label": "Footer" },
          footerLinkRequest,
          footerLinkPrivacy,
          footerLinkTerms
        ),
        footerCopyright
      ),

      // Right: theme toggle + language toggle + location
      el(
        "div",
        { class: mustClass(styles, "footerRight") },
        el("div", { class: mustClass(styles, "footerControls") }, footerTheme.el, footerLang),
        footerLocation
      )
    )
  );

  // Keep toggles in sync on initial render
  window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
  window.dispatchEvent(new Event(LOCALE_CHANGED_EVENT));

  root.append(bg, header, mobileMenu.overlay, main, footer);
  return root;
}
