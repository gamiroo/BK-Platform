import { mustClass } from "../../../../shared/css-modules.js";
import { el, clear } from "../../shared/dom.js";
import styles from "./login.module.css";

async function login(email: string, password: string): Promise<void> {
  const res = await fetch("/api/admin/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error(`Login failed (${res.status})`);
  }
}

export function renderAdminLoginPage(root: HTMLElement): void {
  const status = el("div", { class: mustClass(styles, "status"), "aria-live": "polite" });

  const email = el("input", {
    class: mustClass(styles, "input"),
    type: "email",
    name: "email",
    autocomplete: "email",
    placeholder: "Email",
  }) as HTMLInputElement;

  const password = el("input", {
    class: mustClass(styles, "input"),
    type: "password",
    name: "password",
    autocomplete: "current-password",
    placeholder: "Password",
  }) as HTMLInputElement;

  const btn = el("button", { class: mustClass(styles, "button"), type: "submit" }, "Sign in") as HTMLButtonElement;

  const form = el("form", { class: mustClass(styles, "form") }) as HTMLFormElement;

  form.append(
    el("h1", { class: mustClass(styles, "h1") }, "Admin sign in"),
    el("p", { class: mustClass(styles, "p") }, "Use your admin credentials to continue."),
    status,
    email,
    password,
    btn
  );

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clear(status);
    status.textContent = "";
    btn.disabled = true;

    void (async () => {
      try {
        await login(email.value.trim(), password.value);
        window.location.assign("/admin/dashboard");
      } catch (err) {
        status.textContent = err instanceof Error ? err.message : "Login failed";
      } finally {
        btn.disabled = false;
      }
    })();
  });

  root.append(el("div", { class: mustClass(styles, "page") }, form));
}
