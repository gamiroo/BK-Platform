// src/frontend/shared/theme.ts
export type ThemePreference = "system" | "dark" | "light";

const STORAGE_KEY = "bk_theme_preference";

function isThemePreference(v: unknown): v is ThemePreference {
  return v === "system" || v === "dark" || v === "light";
}

export function getThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isThemePreference(raw) ? raw : "system";
  } catch {
    return "system";
  }
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // ignore
  }
  applyThemePreference(pref);
}

export function applyThemePreference(pref: ThemePreference): void {
  const html = document.documentElement;

  // We always set data-theme so CSS can target:
  // - light: forced light
  // - dark: forced dark
  // - system: CSS media query decides
  html.setAttribute("data-theme", pref);
}

let didInit = false;

export function initTheme(): void {
  if (didInit) return;
  didInit = true;

  const pref = getThemePreference();
  applyThemePreference(pref);

  // When in system mode, we don't need JS to react to OS changes
  // because tokens.css handles system via prefers-color-scheme.
  // But we still re-apply on changes to keep things consistent if needed.
  try {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", () => {
      if (getThemePreference() === "system") applyThemePreference("system");
    });
  } catch {
    // ignore
  }
}

export function nextThemePreference(current: ThemePreference): ThemePreference {
  if (current === "system") return "dark";
  if (current === "dark") return "light";
  return "system";
}
