// src/shared/infra/zoho/env.ts
/**
 * Zoho env loader (server-only).
 *
 * Do not read process.env outside shared/config/env.ts, except here via requireEnv/optionalEnv.
 * This module defines Zoho-specific required configuration.
 */

import { optionalEnv, requireEnv } from "../../config/env.js";

export type ZohoDataCenter = "US" | "AU" | "EU" | "IN" | "CN";

export type ZohoEnv = Readonly<{
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  dataCenter: ZohoDataCenter;
  timeoutMs: number;
  leadSource: string;
}>;

function parseDataCenter(raw: string | undefined): ZohoDataCenter {
  const v = (raw ?? "AU").toUpperCase();
  switch (v) {
    case "US":
    case "AU":
    case "EU":
    case "IN":
    case "CN":
      return v;
    default:
      throw new Error("ZOHO_DATA_CENTER must be one of: US | AU | EU | IN | CN");
  }
}

function parseTimeoutMs(raw: string | undefined): number {
  if (!raw) return 4000;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error("ZOHO_TIMEOUT_MS must be a positive number");
  return Math.floor(n);
}

export function loadZohoEnv(): ZohoEnv {
  const clientId = requireEnv("ZOHO_CLIENT_ID");
  const clientSecret = requireEnv("ZOHO_CLIENT_SECRET");
  const refreshToken = requireEnv("ZOHO_REFRESH_TOKEN");
  const dataCenter = parseDataCenter(optionalEnv("ZOHO_DATA_CENTER"));
  const timeoutMs = parseTimeoutMs(optionalEnv("ZOHO_TIMEOUT_MS"));

  const leadSource = optionalEnv("ZOHO_LEAD_SOURCE") ?? "Website - General Enquiry";

  return {
    clientId,
    clientSecret,
    refreshToken,
    dataCenter,
    timeoutMs,
    leadSource,
  };
}
