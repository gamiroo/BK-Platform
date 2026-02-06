// tests/modules/billing/billing-events-idempotency.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { testDb } from "../../shared/db/db.js";

type DbLike = {
  sql: <T = unknown>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  close: () => Promise<void>;
};

type PgError = { code?: string };

function isPgError(err: unknown): err is PgError {
  return typeof err === "object" && err !== null && "code" in err;
}

function pgErrorCode(err: unknown): string | undefined {
  return isPgError(err) ? err.code : undefined;
}

test("billing_events enforces unique(stripe_event_id, livemode)", async () => {
  const db = testDb() as unknown as DbLike;

  const stripeEventId = `evt_test_${randomBytes(8).toString("hex")}`;
  const livemode = false;

  const base = {
    request_id: randomUuid(),
    stripe_event_id: stripeEventId,
    event_type: "invoice.paid",
    livemode,
    payload_json: { id: stripeEventId, type: "invoice.paid" },
    process_status: "RECEIVED",
  } as const;

  try {
    await db.sql`
      insert into billing_events
        (id, request_id, stripe_event_id, event_type, livemode, payload_json, process_status)
      values
        (gen_random_uuid(), ${base.request_id}::uuid, ${base.stripe_event_id}, ${base.event_type}, ${base.livemode},
         ${JSON.stringify(base.payload_json)}::jsonb, ${base.process_status})
    `;

    await assert.rejects(
      async () => {
        await db.sql`
          insert into billing_events
            (id, request_id, stripe_event_id, event_type, livemode, payload_json, process_status)
          values
            (gen_random_uuid(), ${randomUuid()}::uuid, ${base.stripe_event_id}, ${base.event_type}, ${base.livemode},
             ${JSON.stringify(base.payload_json)}::jsonb, ${base.process_status})
        `;
      },
      (err: unknown) => pgErrorCode(err) === "23505" // unique violation
    );
  } finally {
    await db.sql`delete from billing_events where stripe_event_id = ${stripeEventId} and livemode = ${livemode}`;
    await db.close();
  }
});

function randomUuid(): string {
  return "00000000-0000-4000-8000-000000000000".replace(/[08]/g, (c) =>
    ((Number(c) ^ (Math.floor(Math.random() * 16) & 15)) >> (Number(c) / 4)).toString(16)
  );
}
