export type BillingErrorCode =
  | "STRIPE_SIGNATURE_MISSING"
  | "STRIPE_SIGNATURE_INVALID_FORMAT"
  | "STRIPE_SIGNATURE_INVALID"
  | "STRIPE_SIGNATURE_TIMESTAMP_OUT_OF_RANGE"
  | "STRIPE_WEBHOOK_SECRET_MISSING"
  | "STRIPE_EVENT_JSON_INVALID";

export class BillingError extends Error {
  public readonly code: BillingErrorCode;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(opts: {
    code: BillingErrorCode;
    status: number;
    message: string;
    details?: Record<string, unknown>;
  }) {
    super(opts.message);
    this.code = opts.code;
    this.status = opts.status;
    if (opts.details) this.details = opts.details;
  }
}
