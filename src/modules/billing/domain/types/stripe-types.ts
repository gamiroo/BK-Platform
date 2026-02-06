export type StripeEvent = {
  id: string;
  type: string;
  created: number; // seconds
  livemode: boolean;
  api_version?: string;
  data: { object: Record<string, unknown> };
};

export type StripeSignatureHeader = string;
