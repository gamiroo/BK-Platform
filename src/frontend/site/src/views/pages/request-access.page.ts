// src/frontend/site/src/views/pages/request-access.page.ts
/**
 * Request Access (Enquiry) Page
 * -----------------------------
 * UI-only page.
 *
 * Contract:
 * - NEVER call fetch() directly
 * - ALWAYS use http-client
 * - HTTP errors are standardized (HttpClientError)
 * - Only programmer bugs throw past our handler
 *
 * Why:
 * - Deterministic control flow
 * - Localizable error handling
 * - Security + observability consistency
 */

import { el, clear } from "../../shared/dom.js";
import { renderShell } from "../layout/shell.js";
import styles from "./request-access.module.css";
import { mustClass } from "../../../../shared/css-modules.js";
import { LOCALE_CHANGED_EVENT, t } from "../../../../shared/il8n.js";
import {
  httpPost,
  expectOk,
  HttpClientError,
} from "../../../../lib/http-client.js";

type EnquiryPayload = Readonly<{
  firstName?: string;
  lastName: string;
  email: string;
  phone?: string;
  message: string;
}>;

type EnquiryResponse = Readonly<{
  lead_id: string;
}>;

type TooltipKind = "success" | "error";

type TooltipState = Readonly<{
  kind: TooltipKind;
  title: string;
  message: string;
  onOk: () => void;
}>;

/**
 * Read a trimmed string value from a form.
 */
function readValue(form: HTMLFormElement, name: string): string {
  const v = new FormData(form).get(name);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Clipboard helper with safe fallback.
 */
function copyToClipboard(text: string): void {
  void (async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.append(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  })();
}

/**
 * SVG icon (cannot use `el()` due to typing).
 */
function copyIconSvg(): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");

  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add(mustClass(styles, "icon"));

  const path = document.createElementNS(ns, "path");
  path.setAttribute(
    "d",
    "M8 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"
  );
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");

  const rect = document.createElementNS(ns, "rect");
  rect.setAttribute("x", "4");
  rect.setAttribute("y", "8");
  rect.setAttribute("width", "12");
  rect.setAttribute("height", "12");
  rect.setAttribute("rx", "2");
  rect.setAttribute("stroke", "currentColor");
  rect.setAttribute("stroke-width", "2");

  svg.append(path, rect);
  return svg;
}

/**
 * Modal tooltip (success / error).
 */
function showTooltip(state: TooltipState): void {
  const existing = document.getElementById("bk_request_access_tooltip");
  if (existing) existing.remove();

  const copied = el("span", {
    class: mustClass(styles, "copied"),
    "aria-live": "polite",
  }) as HTMLSpanElement;

  const overlay = el("div", {
    id: "bk_request_access_tooltip",
    class: mustClass(styles, "overlay"),
  }) as HTMLDivElement;

  const dotClass = state.kind === "success" ? "dotSuccess" : "dotError";

  const title = el(
    "h2",
    { class: mustClass(styles, "tooltipTitle") },
    el(
      "span",
      { class: mustClass(styles, "badge") },
      el("span", { class: mustClass(styles, dotClass), "aria-hidden": "true" }),
      state.title
    )
  ) as HTMLHeadingElement;

  const copyBtn = el(
    "button",
    { class: mustClass(styles, "iconButton"), type: "button" },
    copyIconSvg(),
    t("tooltip.copy")
  ) as HTMLButtonElement;

  const okBtn = el(
    "button",
    { class: mustClass(styles, "okButton"), type: "button", autofocus: "true" },
    t("tooltip.ok")
  ) as HTMLButtonElement;

  const tooltip = el(
    "div",
    { class: mustClass(styles, "tooltip"), role: "dialog", "aria-modal": "true" },
    el("div", { class: mustClass(styles, "tooltipHeader") }, title, copyBtn),
    el("p", { class: mustClass(styles, "tooltipBody") }, state.message),
    el("div", { class: mustClass(styles, "tooltipActions") }, copied, okBtn)
  ) as HTMLDivElement;

  const close = (): void => {
    overlay.remove();
    state.onOk();
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") close();
    },
    { once: true }
  );

  copyBtn.addEventListener("click", () => {
    copyToClipboard(state.message);
    copied.textContent = t("tooltip.copied");
    window.setTimeout(() => (copied.textContent = ""), 1200);
  });

  okBtn.addEventListener("click", close);

  overlay.append(tooltip);
  document.body.append(overlay);
  okBtn.focus();
}

function copyToClipboard(text: string): void {
  void (async () => {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.append(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  })();
}

/**
 * IMPORTANT:
 * Our `el()` helper is typed for HTML tags only (HTMLElementTagNameMap),
 * so it cannot safely create SVG. Create SVG nodes using createElementNS.
 */
function copyIconSvg(): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";

  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add(mustClass(styles, "icon"));

  const path = document.createElementNS(ns, "path");
  path.setAttribute(
    "d",
    "M8 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"
  );
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");

  const rect = document.createElementNS(ns, "rect");
  rect.setAttribute("x", "4");
  rect.setAttribute("y", "8");
  rect.setAttribute("width", "12");
  rect.setAttribute("height", "12");
  rect.setAttribute("rx", "2");
  rect.setAttribute("stroke", "currentColor");
  rect.setAttribute("stroke-width", "2");

  svg.append(path, rect);
  return svg;
}

function showTooltip(state: TooltipState): void {
  const existing = document.getElementById("bk_request_access_tooltip");
  if (existing) existing.remove();

  const copied = el("span", { class: mustClass(styles, "copied"), "aria-live": "polite" }) as HTMLSpanElement;

  const overlay = el("div", {
    id: "bk_request_access_tooltip",
    class: mustClass(styles, "overlay"),
  }) as HTMLDivElement;

  const dotClass = state.kind === "success" ? "dotSuccess" : "dotError";

  const title = el(
    "h2",
    { class: mustClass(styles, "tooltipTitle") },
    el(
      "span",
      { class: mustClass(styles, "badge") },
      el("span", { class: mustClass(styles, dotClass), "aria-hidden": "true" }),
      state.title
    )
  ) as HTMLHeadingElement;

  const copyBtn = el(
    "button",
    { class: mustClass(styles, "iconButton"), type: "button" },
    copyIconSvg(),
    t("tooltip.copy")
  ) as HTMLButtonElement;

  const okBtn = el(
    "button",
    {
      class: mustClass(styles, "okButton"),
      type: "button",
      autofocus: "true",
    },
    t("tooltip.ok")
  ) as HTMLButtonElement;

  const tooltip = el(
    "div",
    { class: mustClass(styles, "tooltip"), role: "dialog", "aria-modal": "true" },
    el("div", { class: mustClass(styles, "tooltipHeader") }, title, copyBtn),
    el("p", { class: mustClass(styles, "tooltipBody") }, state.message),
    el("div", { class: mustClass(styles, "tooltipActions") }, copied, okBtn)
  ) as HTMLDivElement;

  const close = (): void => {
    overlay.remove();
    state.onOk();
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") close();
    },
    { once: true }
  );

  copyBtn.addEventListener("click", () => {
    copyToClipboard(state.message);
    copied.textContent = t("tooltip.copied");
    window.setTimeout(() => {
      copied.textContent = "";
    }, 1200);
  });

  okBtn.addEventListener("click", close);

  overlay.append(tooltip);
  document.body.append(overlay);
  okBtn.focus();
}

export function renderRequestAccessPage(root: HTMLElement): void {
  const status = el("div", {
    class: mustClass(styles, "status"),
    "aria-live": "polite",
  }) as HTMLDivElement;

  const form = el("form", { class: mustClass(styles, "form") }) as HTMLFormElement;

  const firstName = el("input", {
    class: mustClass(styles, "input"),
    name: "firstName",
    autocomplete: "given-name",
    placeholder: t("enquiry.first_name"),
  }) as HTMLInputElement;

  const lastName = el("input", {
    class: mustClass(styles, "input"),
    name: "lastName",
    autocomplete: "family-name",
    placeholder: t("enquiry.last_name"),
  }) as HTMLInputElement;

  const email = el("input", {
    class: mustClass(styles, "input"),
    name: "email",
    autocomplete: "email",
    placeholder: t("enquiry.email"),
  }) as HTMLInputElement;

  const phone = el("input", {
    class: mustClass(styles, "input"),
    name: "phone",
    autocomplete: "tel",
    placeholder: t("enquiry.phone"),
  }) as HTMLInputElement;

  const message = el("textarea", {
    class: mustClass(styles, "textarea"),
    name: "message",
    placeholder: t("enquiry.message"),
  }) as HTMLTextAreaElement;

  const submitBtn = el(
    "button",
    { class: mustClass(styles, "button"), type: "submit" },
    t("enquiry.submit")
  ) as HTMLButtonElement;

  const h1 = el("h1", { class: mustClass(styles, "h1") }, t("enquiry.h1"));
  const p = el("p", { class: mustClass(styles, "p") }, t("enquiry.p"));

  const refresh = (): void => {
    h1.textContent = t("enquiry.h1");
    p.textContent = t("enquiry.p");
    firstName.placeholder = t("enquiry.first_name");
    lastName.placeholder = t("enquiry.last_name");
    email.placeholder = t("enquiry.email");
    phone.placeholder = t("enquiry.phone");
    message.placeholder = t("enquiry.message");
    submitBtn.textContent = t("enquiry.submit");
  };

  window.addEventListener(LOCALE_CHANGED_EVENT, refresh);

  form.append(h1, p, status, firstName, lastName, email, phone, message, submitBtn);

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    clear(status);

    const first = readValue(form, "firstName");
    const ph = readValue(form, "phone");

    const payload: EnquiryPayload = {
      lastName: readValue(form, "lastName"),
      email: readValue(form, "email"),
      message: readValue(form, "message"),
      ...(first ? { firstName: first } : {}),
      ...(ph ? { phone: ph } : {}),
    };

    submitBtn.disabled = true;

    void (async () => {
      try {
        const data = expectOk(
          await httpPost<EnquiryResponse>("/api/site/enquiry", payload)
        );

        const msg = t("enquiry.submitted_ref").replace("{ref}", data.lead_id);

        status.textContent = msg;
        form.reset();

        showTooltip({
          kind: "success",
          title: t("tooltip.success_title"),
          message: msg,
          onOk: () => window.location.assign("/"),
        });
      } catch (err: unknown) {
        // Standardized HTTP/network failures:
        // - server envelope ok:false
        // - NETWORK_ERROR / INVALID_RESPONSE, etc.
        if (err instanceof HttpClientError) {
          const msg = err.message || t("enquiry.failed_generic");

          status.textContent = msg;

          showTooltip({
            kind: "error",
            title: t("tooltip.error_title"),
            message: msg,
            onOk: () => window.location.assign("/"),
          });

          return;
        }

        // Programmer bug: surface it in console, show generic error to user.
        // eslint-disable-next-line no-console
        console.error("[request-access] unexpected error", err);

        const msg = t("enquiry.failed_generic");
        status.textContent = msg;

        showTooltip({
          kind: "error",
          title: t("tooltip.error_title"),
          message: msg,
          onOk: () => window.location.assign("/"),
        });
      } finally {
        submitBtn.disabled = false;
      }
    })();
  });

  root.append(renderShell(el("div", { class: mustClass(styles, "page") }, form)));
}
