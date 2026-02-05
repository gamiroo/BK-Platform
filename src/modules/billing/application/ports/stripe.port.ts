export type StripeWebhookVerifyFailCode =
  | "STRIPE_SIGNATURE_MISSING"
  | "STRIPE_SIGNATURE_INVALID_FORMAT"
  | "STRIPE_SIGNATURE_INVALID"
  | "STRIPE_SIGNATURE_TIMESTAMP_OUT_OF_RANGE";

export type StripeWebhookVerifier = (args: {
  rawBody: Uint8Array;
  signatureHeader: string | null;
  secret: string;
  nowMs: number;
  toleranceSec: number;
}) => { ok: true } | { ok: false; code: StripeWebhookVerifyFailCode; message: string; details?: Record<string, unknown> };
