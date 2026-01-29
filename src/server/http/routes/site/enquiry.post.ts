// src/server/http/routes/site/enquiry.post.ts
import type { RequestContext } from "../../../../shared/logging/request-context.js";
import { AppError } from "../../../../shared/errors/app-error.js";
import { balanceguardSite } from "../../../../shared/security/balanceguard/wrappers.js";

type EnquiryInput = Readonly<{
  firstName?: string;
  lastName: string;
  email: string;
  phone?: string;
  message: string;
}>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function readString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

async function readJson(req: Request): Promise<unknown> {
  try {
    return (await req.json()) as unknown;
  } catch {
    throw new AppError({
      code: "ENQUIRY_INVALID_JSON",
      status: 400,
      message: "Invalid JSON body",
    });
  }
}

function parseEnquiry(body: unknown): EnquiryInput {
  if (!isRecord(body)) {
    throw new AppError({
      code: "ENQUIRY_INVALID_BODY",
      status: 400,
      message: "Body must be a JSON object",
    });
  }

  const lastName = readString(body["lastName"]);
  const email = readString(body["email"]);
  const message = readString(body["message"]);

  if (!lastName || !email || !message) {
    throw new AppError({
      code: "ENQUIRY_MISSING_FIELDS",
      status: 400,
      message: "Missing required fields",
      details: { required: ["lastName", "email", "message"] },
    });
  }

  const firstName = readString(body["firstName"]) ?? undefined;
  const phone = readString(body["phone"]) ?? undefined;

  // exactOptionalPropertyTypes-safe: omit optionals when absent
  return {
    lastName,
    email,
    message,
    ...(firstName ? { firstName } : {}),
    ...(phone ? { phone } : {}),
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const postSiteEnquiry = balanceguardSite(
  {
    // Site surface: keep it public, but do apply a tighter rate limit to protect the endpoint.
    rateLimit: { max: 10, windowMs: 60_000 },
  },
  async (_ctx: RequestContext, req: Request) => {
    const body = await readJson(req);
    const input = parseEnquiry(body);

    // TODO: wire into modules/enquiry application service + persist.
    // For now, return a generated lead id so the UI flow works end-to-end.
    const lead_id = crypto.randomUUID();

    return json({ lead_id, received: input.email }, 201);
  }
);
