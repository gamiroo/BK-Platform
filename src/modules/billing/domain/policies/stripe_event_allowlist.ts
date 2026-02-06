export const STRIPE_BILLING_EVENT_ALLOWLIST = new Set<string>([
  // Packs / one-off payments
  "checkout.session.completed",
  "charge.succeeded",
  "charge.refunded",
  "refund.created",

  // Invoices & subscriptions
  "invoice.created",
  "invoice.finalized",
  "invoice.payment_succeeded",
  "invoice.payment_failed",

  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",

  // Optional (allowlisted but not handled yet)
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
]);
