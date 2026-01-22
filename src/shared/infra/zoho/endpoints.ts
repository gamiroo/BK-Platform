// src/shared/infra/zoho/endpoints.ts
import type { ZohoDataCenter } from "./env.ts";

export type ZohoEndpoints = Readonly<{
  accountsBaseUrl: string;
  apiBaseUrl: string;
}>;

export function zohoEndpoints(dc: ZohoDataCenter): ZohoEndpoints {
  switch (dc) {
    case "US":
      return { accountsBaseUrl: "https://accounts.zoho.com", apiBaseUrl: "https://www.zohoapis.com" };
    case "AU":
      return { accountsBaseUrl: "https://accounts.zoho.com.au", apiBaseUrl: "https://www.zohoapis.com.au" };
    case "EU":
      return { accountsBaseUrl: "https://accounts.zoho.eu", apiBaseUrl: "https://www.zohoapis.eu" };
    case "IN":
      return { accountsBaseUrl: "https://accounts.zoho.in", apiBaseUrl: "https://www.zohoapis.in" };
    case "CN":
      return { accountsBaseUrl: "https://accounts.zoho.com.cn", apiBaseUrl: "https://www.zohoapis.com.cn" };
    default: {
      const _exhaustive: never = dc;
      return _exhaustive;
    }
  }
}
