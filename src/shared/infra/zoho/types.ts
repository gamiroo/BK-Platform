// src/shared/infra/zoho/types.ts

export type ZohoTokenResponse = Readonly<{
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  api_domain?: string;
}>;

export type ZohoCRMLead = Readonly<{
  Last_Name: string; // required by Zoho Leads
  Email?: string;
  Description?: string;
  Lead_Source?: string;
}>;

export type ZohoCRMResponseDataItem = Readonly<{
  status?: string;
  message?: string;
  details?: { id?: string };
  id?: string;
  record?: { id?: string };
}>;

export type ZohoCRMResponse = Readonly<{
  data?: readonly ZohoCRMResponseDataItem[];
}>;
