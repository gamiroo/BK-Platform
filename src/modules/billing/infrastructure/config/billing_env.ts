export function mustGetStripeWebhookSecretBilling(env: Record<string, string | undefined>): string {
  const v = env["STRIPE_WEBHOOK_SECRET_BILLING"];
  return v ? v : "";
}
