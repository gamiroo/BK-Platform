// src/frontend/admin/src/views/pages/login.page.ts
//
// Admin login page.
//
// Non-negotiables:
// - NEVER call the browser network API directly.
// - ALWAYS use the canonical frontend HTTP client.
// - Server is the source of truth for cookies (session + CSRF).
// - This page must NOT write cookies via document.cookie.
//   (Doing so causes duplicate cookies and breaks invariants.)

import { mustClass } from "../../../../shared/css-modules.js";
import { el, clear } from "../../shared/dom.js";
import styles from "./login.module.css";

import { httpPost, expectOk, HttpClientError } from "../../../../lib/http-client.js";

type AdminLoginResponse = Readonly<{
  actor: Readonly<{ kind: "admin"; role: "admin"; user_id: string }>;
  csrf_token?: string;
  csrf_cookie?: string;
}>;


async function login(email: string, password: string): Promise<AdminLoginResponse> {
  return expectOk(
    await httpPost<AdminLoginResponse>("/api/admin/auth/login", {
      email,
      password,
    })
  );
}

function friendlyLoginError(err: HttpClientError): string {
  switch (err.code) {
    case "NETWORK_ERROR":
      return "Unable to reach the server. Please try again.";
    case "INVALID_RESPONSE":
      return "Unexpected server response. Please try again.";
    case "AUTH_INVALID":
    case "UNAUTHENTICATED":
      return "Incorrect email or password.";
    case "WRONG_SURFACE":
      return "This session belongs to a different app surface. Please sign in again.";
    case "CSRF_REQUIRED":
    case "CSRF_INVALID":
      // Login should not require CSRF, but keep this message stable if wiring changes.
      return "Security check failed. Please refresh and try again.";
    default:
      return err.message || "Sign in failed. Please try again.";
  }
}

export type AdminLoginPageOpts = Readonly<{
  // Allow async so app gate can run a /me probe if it wants.
  onLoggedIn: () => void | Promise<void>;
}>;

export function renderAdminLoginPage(root: HTMLElement, opts: AdminLoginPageOpts): void {
  root.replaceChildren();

  const status = el("div", {
    class: mustClass(styles, "status"),
    "aria-live": "polite",
  }) as HTMLDivElement;

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

  const setStatus = (msg: string): void => {
    clear(status);
    status.textContent = msg;
  };

  const setDisabled = (disabled: boolean): void => {
    btn.disabled = disabled;
    email.disabled = disabled;
    password.disabled = disabled;
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const emailValue = email.value.trim();
    const passValue = password.value;

    setStatus("");
    setDisabled(true);
    setStatus("Signing in…");

    void (async () => {
      try {
        // ✅ Server sets session + CSRF cookies via Set-Cookie.
        // Do NOT write cookies client-side (prevents duplicates & drift).
        await login(emailValue, passValue);

        // ✅ Let the app gate/router flip auth state + navigate.
        await opts.onLoggedIn();
      } catch (err: unknown) {
        if (err instanceof HttpClientError) {
          setStatus(friendlyLoginError(err));
          return;
        }

        // eslint-disable-next-line no-console
        console.error("[admin-login] unexpected error", err);
        setStatus("Sign in failed. Please try again.");
      } finally {
        setDisabled(false);
      }
    })();
  });

  root.append(el("div", { class: mustClass(styles, "page") }, form));
}
