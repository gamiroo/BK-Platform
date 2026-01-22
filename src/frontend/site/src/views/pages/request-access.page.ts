import { el, clear } from "../../shared/dom.js";
import { renderShell } from "../layout/shell.js";
import { apiUrl } from "../../shared/api.js";
import styles from "./request-access.module.css";
import { mustClass } from "../../../../shared/css-modules.js";

type EnquiryPayload = Readonly<{
  firstName?: string;
  lastName: string;
  email: string;
  phone?: string;
  message: string;
}>;

function readValue(form: HTMLFormElement, name: string): string {
  const v = new FormData(form).get(name);
  return typeof v === "string" ? v.trim() : "";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function readErrorMessage(v: unknown): string | null {
  if (!isRecord(v)) return null;

  const err = v["error"];
  if (!isRecord(err)) return null;

  const msg = err["message"];
  return typeof msg === "string" && msg.trim().length > 0 ? msg : null;
}

async function submit(payload: EnquiryPayload): Promise<Readonly<{ lead_id: string }>> {
  const res = await fetch(apiUrl("/api/site/enquiry"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = (await res.json()) as unknown;

  if (!res.ok) {
    const msg = readErrorMessage(body) ?? "Submission failed";
    throw new Error(msg);
  }

  if (!isRecord(body)) throw new Error("Submission failed");
  const data = body["data"];
  if (!isRecord(data)) throw new Error("Submission failed");

  const lead_id = data["lead_id"];
  if (typeof lead_id !== "string") throw new Error("Submission failed");

  return { lead_id };
}

export function renderRequestAccessPage(root: HTMLElement): void {
  const status = el("div", { class: mustClass(styles, "status") });

  const form = el("form", { class: mustClass(styles, "form") }) as HTMLFormElement;

  const firstName = el("input", {
    class: mustClass(styles, "input"),
    name: "firstName",
    autocomplete: "given-name",
    placeholder: "First name (optional)",
  }) as HTMLInputElement;

  const lastName = el("input", {
    class: mustClass(styles, "input"),
    name: "lastName",
    autocomplete: "family-name",
    placeholder: "Last name *",
  }) as HTMLInputElement;

  const email = el("input", {
    class: mustClass(styles, "input"),
    name: "email",
    autocomplete: "email",
    placeholder: "Email *",
  }) as HTMLInputElement;

  const phone = el("input", {
    class: mustClass(styles, "input"),
    name: "phone",
    autocomplete: "tel",
    placeholder: "Phone (optional)",
  }) as HTMLInputElement;

  const message = el("textarea", {
    class: mustClass(styles, "textarea"),
    name: "message",
    placeholder: "Tell us what you’re looking for *",
  }) as HTMLTextAreaElement;

  const submitBtn = el(
    "button",
    { class: mustClass(styles, "button"), type: "submit" },
    "Submit enquiry"
  ) as HTMLButtonElement;

  form.append(
    el("h1", { class: mustClass(styles, "h1") }, "Request Access"),
    el("p", { class: mustClass(styles, "p") }, "Submit an enquiry and we’ll follow up personally."),
    status,
    firstName,
    lastName,
    email,
    phone,
    message,
    submitBtn
  );

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    clear(status);
    status.textContent = "";

    const fn = readValue(form, "firstName");
    const ph = readValue(form, "phone");

    const payload: EnquiryPayload = {
      lastName: readValue(form, "lastName"),
      email: readValue(form, "email"),
      message: readValue(form, "message"),
      ...(fn ? { firstName: fn } : {}),
      ...(ph ? { phone: ph } : {}),
    };

    submitBtn.disabled = true;

    void (async () => {
      try {
        const out = await submit(payload);
        status.textContent = `Submitted successfully. Reference: ${out.lead_id}`;
        form.reset();
      } catch (err) {
        status.textContent = err instanceof Error ? err.message : "Submission failed";
      } finally {
        submitBtn.disabled = false;
      }
    })();
  });

  root.append(renderShell(form));
}
