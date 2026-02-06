// src/frontend/client/src/views/pages/login.page.ts
//
// Client login page.
//
// Rules:
// - NEVER call fetch() directly (use http-client).
// - Server is the source of truth for cookies (session + CSRF).
// - This page must NOT write cookies via document.cookie.
//   (Writing cookies client-side causes duplicates + path drift.)

import { mustClass } from "../../../../../frontend/shared/css-modules.js";
import { uiCard, uiSectionHeader } from "../../../../../frontend/shared/ui/index.js";
import { el, clear } from "../../shared/dom.js";
import styles from "./login.module.css";

import { httpPost, expectOk, HttpClientError } from "../../../../../frontend/lib/http-client.js";

type ClientLoginResponse = Readonly<{
  actor: Readonly<{
    kind: "client";
    role: "client";
    user_id: string;
  }>;
  // csrf metadata can exist, but the UI does not need it
  csrf_token?: string;
  csrf_cookie?: string;
}>;

async function login(email: string, password: string): Promise<ClientLoginResponse> {
  return expectOk(
    await httpPost<ClientLoginResponse>("/api/client/auth/login", {
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
    default:
      return err.message || "Login failed. Please try again.";
  }
}

export function renderClientLoginPage(
  root: HTMLElement,
  opts: Readonly<{ onLoggedIn: () => void | Promise<void> }>
): void {
  root.replaceChildren();

  const header = uiSectionHeader({
    title: "Welcome back",
    subtitle: "Log in to manage your weekly order.",
  });

  const status = el("div", {
    class: mustClass(styles, "status"),
    "aria-live": "polite",
  }) as HTMLDivElement;

  const card = uiCard({ title: "Client login", subtitle: "Enter your credentials" });
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

  const setStatus = (msg: string): void => {
    clear(status);
    status.textContent = msg;
  };

  const setDisabled = (disabled: boolean): void => {
    btn.disabled = disabled;
    email.disabled = disabled;
    pass.disabled = disabled;
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const emailValue = email.value.trim();
    const passValue = pass.value;

    setStatus("");
    setDisabled(true);
    setStatus("Signing in…");

    void (async () => {
      try {
        // ✅ Server sets session + CSRF cookies via Set-Cookie.
        // Do NOT write cookies client-side.
        await login(emailValue, passValue);

        // ✅ Let the app-level gate update auth + route.
        await opts.onLoggedIn();
      } catch (err: unknown) {
        if (err instanceof HttpClientError) {
          setStatus(friendlyLoginError(err));
          return;
        }

        // eslint-disable-next-line no-console
        console.error("[client-login] unexpected error", err);
        setStatus("Login failed. Please try again.");
      } finally {
        setDisabled(false);
      }
    })();
  });

  root.append(el("div", { class: mustClass(styles, "page") }, header, card.el));
}
