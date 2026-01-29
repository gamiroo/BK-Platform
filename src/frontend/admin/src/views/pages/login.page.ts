// src/frontend/admin/src/views/pages/login.page.ts
//
// Admin login page.
//
// Non-negotiables:
// - NEVER call the browser network API directly.
// - ALWAYS use the canonical frontend HTTP client.
// - Treat HttpClientError as the expected failure path.
// - Never leak server internals to the user.

import { mustClass } from "../../../../shared/css-modules.js";
import { el, clear } from "../../shared/dom.js";
import styles from "./login.module.css";

import {
  httpPost,
  expectOk,
  HttpClientError,
} from "../../../../lib/http-client.js";

/**
 * Server contract (current minimal shape):
 * - /api/admin/auth/login returns the canonical envelope.
 * - Success data may be empty; we don't depend on it yet.
 *
 * We still type it explicitly so the call sites stay stable when
 * we later add actor/context payloads.
 */
type AdminLoginResponse = Readonly<Record<string, never>>;

/**
 * Perform login.
 *
 * Important:
 * - We use expectOk() so the rest of the UI can treat failures uniformly
 *   (HttpClientError with {code, message, request_id?}).
 */
async function login(email: string, password: string): Promise<void> {
  expectOk(
    await httpPost<AdminLoginResponse>("/api/admin/auth/login", {
      email,
      password,
    })
  );
}

/**
 * Convert HttpClientError into calm, user-safe copy.
 * We avoid technical phrasing and never show raw server error codes.
 */
function friendlyLoginError(err: HttpClientError): string {
  // Keep these mappings intentionally conservative.
  // We can expand/adjust once server-side codes are finalized.
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
      // Fall back to the server-provided message (it should be safe by contract),
      // but keep it calm and not overly technical.
      return err.message || "Sign in failed. Please try again.";
  }
}

export function renderAdminLoginPage(root: HTMLElement): void {
  const status = el("div", {
    class: mustClass(styles, "status"),
    "aria-live": "polite",
  });

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

  const btn = el(
    "button",
    { class: mustClass(styles, "button"), type: "submit" },
    "Sign in"
  ) as HTMLButtonElement;

  const form = el("form", { class: mustClass(styles, "form") }) as HTMLFormElement;

  form.append(
    el("h1", { class: mustClass(styles, "h1") }, "Admin sign in"),
    el("p", { class: mustClass(styles, "p") }, "Use your admin credentials to continue."),
    status,
    email,
    password,
    btn
  );

  // Keep handler sync; launch async explicitly.
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clear(status);
    status.textContent = "";
    btn.disabled = true;

    void (async () => {
      try {
        await login(email.value.trim(), password.value);

        // On success we navigate to the Admin dashboard.
        // We use assign() so the browser location matches the surface route
        // and the boot logic can re-check /auth/me as needed.
        window.location.assign("/admin/dashboard");
      } catch (err: unknown) {
        if (err instanceof HttpClientError) {
          status.textContent = friendlyLoginError(err);
          return;
        }

        // Programmer bug: surface it in console, show generic error to user.
        // eslint-disable-next-line no-console
        console.error("[admin-login] unexpected error", err);

        status.textContent = "Sign in failed. Please try again.";
      } finally {
        btn.disabled = false;
      }
    })();
  });

  root.append(el("div", { class: mustClass(styles, "page") }, form));
}
