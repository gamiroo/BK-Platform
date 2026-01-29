// src/shared/infra/zoho/crm.ts
/**
 * Zoho CRM client (minimal: create Lead).
 */

import { AppError } from "../../errors/app-error.js";
import { logger } from "../../logging/logger.js";
import { loadZohoEnv } from "./env.js";
import { zohoEndpoints } from "./endpoints.js";
import { getZohoAccessToken } from "./oauth.js";
import type { ZohoCRMLead, ZohoCRMResponse } from "./types.js";

function abortAfter(ms: number): AbortSignal {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  if (typeof t.unref === "function") t.unref();
  return c.signal;
}

export type CreateLeadResult = Readonly<{ leadId: string }>;

function extractLeadId(result: ZohoCRMResponse): string | null {
  const first = result.data?.[0];
  if (!first) return null;

  if (first.status && (first.status === "error" || first.status === "failed")) return null;

  const candidates: Array<string | undefined> = [
    first.details?.id,
    first.id,
    first.record?.id,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }

  return null;
}


export async function createZohoLead(input: ZohoCRMLead): Promise<CreateLeadResult> {
  const env = loadZohoEnv();
  const eps = zohoEndpoints(env.dataCenter);
  const token = await getZohoAccessToken();

  const endpoint = `${eps.apiBaseUrl}/crm/v2/Leads`;

  const payload = { data: [input] };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: abortAfter(env.timeoutMs),
  });

  const text = await res.text();

  if (!res.ok) {
    logger.error(
      {
        event: "ZOHO_LEAD_CREATE_FAILED",
        status: res.status,
        body: text.slice(0, 400),
      },
      "zoho_lead_create_failed"
    );

    throw new AppError({
      code: "ZOHO_SYNC_FAILED",
      status: 502,
      message: "Upstream CRM failed",
    });
  }

  let data: ZohoCRMResponse;
  try {
    data = JSON.parse(text) as ZohoCRMResponse;
  } catch {
    throw new AppError({
      code: "ZOHO_SYNC_FAILED",
      status: 502,
      message: "Upstream CRM failed",
    });
  }

  const id = extractLeadId(data);

  if (!id) {
    logger.error(
      { event: "ZOHO_LEAD_CREATE_BAD_RESPONSE", body: text.slice(0, 400) },
      "zoho_lead_create_bad_response"
    );

    throw new AppError({
      code: "ZOHO_SYNC_FAILED",
      status: 502,
      message: "Upstream CRM failed",
    });
  }

  return { leadId: id };
}
