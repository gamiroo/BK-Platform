// src/frontend/client/src/views/pages/login.page.ts
//
// Client login page.
//
// Non-negotiables:
// - NEVER call the browser network API directly.
// - ALWAYS use the canonical frontend HTTP client.
// - Treat HttpClientError as the expected failure path.
// - Never leak internal error details to the user.
//
// This file previously had a placeholder "always succeed" timer.
// We replace it with a real POST /api/client/auth/login call.

import { mustClass } from "../../../../../frontend/shared/css-modules.js";
import { uiCard, uiSectionHeader } from "../../../../../frontend/shared/ui/index.js";
import { el, clear } from "../../shared/dom.js";
import { renderClientShell } from "../layout/shell.js";
import styles from "./login.module.css";

import {
  httpPost,
  expectOk,
  HttpClientError,
} from "../../../../../frontend/lib/http-client.js";

/**
 * Server contract (minimal):
 * - /api/client/auth/login returns the canonical envelope.
 * - Success data may be empty for now.
 *
 * We still type it so the call site stays stable when we later
 * return actor/context details.
 */
type ClientLoginResponse = Readonly<Record<string, never>>;

async function login(email: string, password: string): Promise<void> {
  expectOk(
    await httpPost<ClientLoginResponse>("/api/client/auth/login", {
      email,
      password,
    })
  );
}

/**
 * Convert HttpClientError into calm, user-safe copy.
 * Keep this conservative until server error codes/messages are final.
 */
function friendlyLoginError(err: HttpClientError): string {
  switch (err.code) {
    case "NETWORK_ERROR":
      return "Unable to reach the server. Please try again.";
    case "INVALID_RESPONSE":
      return "Unexpected server response. Please try again.";
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
  opts: Readonly<{ onLoggedIn: () => void }>
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

  const btn = el(
    "button",
    { class: mustClass(styles, "button"), type: "submit" },
    "Log in"
  ) as HTMLButtonElement;

  form.append(status, email, pass, btn);
  card.body.append(form);

  // Keep handler sync; launch async explicitly.
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    clear(status);
    status.textContent = "";

    const emailValue = email.value.trim();
    const passValue = pass.value;

    btn.disabled = true;

    void (async () => {
      try {
        await login(emailValue, passValue);

        // On success, route to dashboard via callback.
        // The router/app will re-check /auth/me on next boot if needed.
        opts.onLoggedIn();
      } catch (err: unknown) {
        if (err instanceof HttpClientError) {
          status.textContent = friendlyLoginError(err);
          return;
        }

        // Programmer bug: surface in console, show generic message.
        // eslint-disable-next-line no-console
        console.error("[client-login] unexpected error", err);

        status.textContent = "Login failed. Please try again.";
      } finally {
        btn.disabled = false;
      }
    })();
  });

  const content = el("div", { class: mustClass(styles, "page") }, header, card.el);

  // Login page renders shell too (footer has theme toggle; menu also exists).
  // On the login page, logout is a no-op.
  root.append(renderClientShell(content, { onLogout: () => {} }));
}
