import { mustClass } from "../../../../../frontend/shared/css-modules.js";
import { uiCard, uiSectionHeader } from "../../../../../frontend/shared/ui/index.js";
import { el } from "../../shared/dom.js";
import { renderClientShell } from "../layout/shell.js";
import styles from "./login.module.css";

export function renderClientLoginPage(
  root: HTMLElement,
  opts: Readonly<{ onLoggedIn: () => void }>
): void {
  root.replaceChildren();

  const header = uiSectionHeader({
    title: "Welcome back",
    subtitle: "Log in to manage your weekly order (scaffold).",
  });

  const status = el("div", { class: mustClass(styles, "status"), "aria-live": "polite" });

  const card = uiCard({ title: "Client login", subtitle: "Placeholder auth UI" });
  const form = el("form", { class: mustClass(styles, "form") }) as HTMLFormElement;

  const email = el("input", {
    class: mustClass(styles, "input"),
    name: "email",
    autocomplete: "email",
    placeholder: "Email",
  }) as HTMLInputElement;

  const pass = el("input", {
    class: mustClass(styles, "input"),
    name: "password",
    autocomplete: "current-password",
    placeholder: "Password",
    type: "password",
  }) as HTMLInputElement;

  const btn = el("button", { class: mustClass(styles, "button"), type: "submit" }, "Log in") as HTMLButtonElement;

  form.append(status, email, pass, btn);
  card.body.append(form);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    status.textContent = "";
    btn.disabled = true;

    // Placeholder: always "succeeds"
    window.setTimeout(() => {
      btn.disabled = false;
      opts.onLoggedIn();
    }, 200);
  });

  const content = el("div", { class: mustClass(styles, "page") }, header, card.el);

  // Login page renders shell too (footer has theme toggle; menu also exists)
  root.append(renderClientShell(content, { onLogout: () => {} }));
}
