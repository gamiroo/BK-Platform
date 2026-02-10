# Billing module (Stripe)

Billing is the ONLY module that communicates with Stripe.

Responsibilities:

- Verify Stripe webhook signatures (raw body + stripe-signature + whsec)
- Ingest webhook events into billing_events idempotently
- Route allowlisted Stripe event types to handlers
- Persist provider-neutral money facts (billing_transactions, billing_line_items, billing_refunds)
- Dispatch provider-neutral outcomes to Packs/Subscriptions later

Non-negotiables:

- Never trust Stripe payloads without signature verification
- All writes must be idempotent (Stripe replays are normal)
- Never leak sensitive payloads to logs or responses
- Transport must remain thin; domain policies live in domain/
