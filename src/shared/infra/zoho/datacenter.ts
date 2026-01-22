// src/shared/infra/zoho/datacenter.ts
/**
 * Zoho datacenter mapping (infra-only).
 *
 * Contract:
 * - Accepts the Zoho "data center" code (AU/US/EU/IN/CN)
 * - Returns OAuth + API base URLs
 *
 * Fail-closed:
 * - Unknown values throw (misconfig should not silently default)
 */

import { AppError } from "../../errors/app-error.js";

export type ZohoDataCenter = "AU" | "US" | "EU" | "IN" | "CN";

export type ZohoEndpoints = Readonly<{
  oauthBase: string;
  apiBase: string;
}>;

export function parseZohoDataCenter(raw: string): ZohoDataCenter {
  const v = raw.toUpperCase();
  switch (v) {
    case "AU":
    case "US":
    case "EU":
    case "IN":
    case "CN":
      return v;
    default:
      throw new AppError({
        code: "INTERNAL_ERROR",
        status: 500,
        message: "Invalid ZOHO_DATA_CENTER",
        details: { value: raw },
      });
  }
}

export function zohoEndpoints(dc: ZohoDataCenter): ZohoEndpoints {
  switch (dc) {
    case "US":
      return { oauthBase: "https://accounts.zoho.com", apiBase: "https://www.zohoapis.com" };
    case "AU":
      return { oauthBase: "https://accounts.zoho.com.au", apiBase: "https://www.zohoapis.com.au" };
    case "EU":
      return { oauthBase: "https://accounts.zoho.eu", apiBase: "https://www.zohoapis.eu" };
    case "IN":
      return { oauthBase: "https://accounts.zoho.in", apiBase: "https://www.zohoapis.in" };
    case "CN":
      return { oauthBase: "https://accounts.zoho.com.cn", apiBase: "https://www.zohoapis.com.cn" };
    default: {
      const _exhaustive: never = dc;
      return _exhaustive;
    }
  }
}
