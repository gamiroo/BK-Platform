// src/modules/enquiry/application/submit-enquiry.ts
/**
 * Submit enquiry use-case.
 *
 * Fail-closed:
 * - If Zoho write fails, the enquiry is NOT accepted.
 */

import { AppError } from "../../../shared/errors/app-error.js";
import type { EnquirySubmitInput } from "./types.js";
import { createZohoLead } from "../../../shared/infra/zoho/crm.js";
import type { ZohoCRMLead } from "../../../shared/infra/zoho/types.js";

function isEmail(s: string): boolean {
  // Simple, deterministic check (not RFC-perfect).
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function validateEnquiryInput(raw: unknown): EnquirySubmitInput {
  if (!raw || typeof raw !== "object") {
    throw new AppError({ code: "VALIDATION_FAILED", status: 400, message: "Invalid JSON body" });
  }

  const o = raw as Record<string, unknown>;

  // NEW: support legacy `name` as fallback
  const name = typeof o.name === "string" ? o.name.trim() : "";

  let firstName = typeof o.firstName === "string" ? o.firstName.trim() : undefined;
  let lastName = typeof o.lastName === "string" ? o.lastName.trim() : "";

  // If lastName not provided, try derive from `name`
  if (!lastName && name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      lastName = parts[0]!;
    } else if (parts.length >= 2) {
      lastName = parts.at(-1)!;
      firstName = parts.slice(0, -1).join(" ");
    }
  }

  const email = typeof o.email === "string" ? o.email.trim() : "";
  const message = typeof o.message === "string" ? o.message.trim() : "";
  const phone = typeof o.phone === "string" ? o.phone.trim() : undefined;

  if (!lastName) {
    throw new AppError({ code: "VALIDATION_FAILED", status: 400, message: "lastName is required" });
  }
  if (!email || !isEmail(email)) {
    throw new AppError({ code: "VALIDATION_FAILED", status: 400, message: "email is invalid" });
  }
  if (!message || message.length < 3) {
    throw new AppError({ code: "VALIDATION_FAILED", status: 400, message: "message is required" });
  }
  if (message.length > 5000) {
    throw new AppError({ code: "VALIDATION_FAILED", status: 400, message: "message is too long" });
  }

  const out: {
    firstName?: string;
    lastName: string;
    email: string;
    phone?: string;
    message: string;
  } = { lastName, email, message };

  if (firstName) out.firstName = firstName;
  if (phone) out.phone = phone;

  return out;
}

export async function submitEnquiry(input: EnquirySubmitInput): Promise<Readonly<{ leadId: string }>> {
  const fullName = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();

  const descriptionLines: string[] = [];
  descriptionLines.push(input.message);

  if (input.phone) descriptionLines.push(`Phone: ${input.phone}`);
  if (fullName) descriptionLines.push(`Name: ${fullName}`);
  descriptionLines.push(`Email: ${input.email}`);

  const description = descriptionLines.join("\n");

  // ✅ Zoho fields
  const leadInput: ZohoCRMLead = {
    Last_Name: input.lastName,          // required by Zoho
    ...(input.firstName ? { First_Name: input.firstName } : {}),
    Email: input.email,
    Lead_Source: "Website Enquiry",
    Description: description,
  };

  return await createZohoLead(leadInput);
}