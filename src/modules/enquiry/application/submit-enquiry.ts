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

  const lastName = typeof o.lastName === "string" ? o.lastName.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim() : "";
  const message = typeof o.message === "string" ? o.message.trim() : "";

  const firstName = typeof o.firstName === "string" ? o.firstName.trim() : undefined;
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
  // Build a deterministic description for Zoho.
  // Keep minimal CRM fields; extra info goes into Description.
  const descriptionLines: string[] = [];
  descriptionLines.push(input.message);

  if (input.phone) descriptionLines.push(`Phone: ${input.phone}`);
  if (input.firstName) descriptionLines.push(`First name: ${input.firstName}`);
  descriptionLines.push(`Last name: ${input.lastName}`);
  descriptionLines.push(`Email: ${input.email}`);

  const description = descriptionLines.join("\n");

  // Zoho Lead payload (minimal; fail-closed)
  // IMPORTANT: Use Zoho field keys (not internal enquiry keys).
const base: {
  Last_Name: string;
  Email?: string;
  Lead_Source?: string;
  Description?: string;
} = {
  Last_Name: input.lastName,
};

if (input.email) base.Email = input.email;
base.Lead_Source = "Website Enquiry";
base.Description = description;

const leadInput: ZohoCRMLead = base;


  return await createZohoLead(leadInput);
}
