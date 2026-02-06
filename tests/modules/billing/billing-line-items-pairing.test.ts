// tests/modules/billing/billing-line-items-pairing.test.ts
import test from "node:test";
import assert from "node:assert/strict";
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

test("billing_line_items enforces line_type <-> bk_reference_type pairing", async () => {
  const db = testDb() as unknown as DbLike;

  const userId = randomUuid();
  const accountId = randomUuid();

  const stripeObjectId = `in_test_${Math.random().toString(16).slice(2)}`;

  let billingTxId: string | null = null;

  try {
    await seedAccount(db, userId, accountId);

    const inserted = await db.sql<Array<{ id: string }>>`
      insert into billing_transactions
        (id, request_id, account_id, stripe_object_type, stripe_object_id, purpose, kind,
         amount_cents, currency, status, occurred_at, created_at, updated_at)
      values
        (gen_random_uuid(), ${randomUuid()}::uuid, ${accountId}::uuid,
         'invoice', ${stripeObjectId}, 'SUBSCRIPTION_PAYMENT', 'CHARGE',
         1000, 'AUD', 'SUCCEEDED', now(), now(), now())
      returning id
    `;

    billingTxId = inserted[0]?.id ?? null;
    assert.ok(billingTxId, "expected billing transaction id");

    await assert.rejects(
      async () => {
        await db.sql`
          insert into billing_line_items
            (id, request_id, billing_transaction_id, line_type, stripe_price_id, quantity,
             bk_reference_type, bk_reference_id, created_at, updated_at)
          values
            (gen_random_uuid(), ${randomUuid()}::uuid, ${billingTxId}::uuid,
             'PACK', 'price_test', 1,
             'SUBSCRIPTION_PLAN', ${randomUuid()}::uuid, now(), now())
        `;
      },
      (err: unknown) => pgErrorCode(err) === "23514" // CHECK violation
    );
  } finally {
    if (billingTxId) {
      await db.sql`delete from billing_transactions where id = ${billingTxId}::uuid`;
    }
    await cleanupAccount(db, userId, accountId);
    await db.close();
  }
});

async function seedAccount(db: DbLike, userId: string, accountId: string) {
  await db.sql`
    insert into users (id, email, status, created_at, updated_at)
    values (${userId}::uuid, ${`tmp_${userId}@balance.local`}, 'ACTIVE', now(), now())
    on conflict do nothing
  `;

  await db.sql`
    insert into accounts (id, account_type, status, primary_user_id, created_at, updated_at)
    values (${accountId}::uuid, 'CUSTOMER', 'ACTIVE', ${userId}::uuid, now(), now())
    on conflict do nothing
  `;
}

async function cleanupAccount(db: DbLike, userId: string, accountId: string) {
  await db.sql`delete from accounts where id = ${accountId}::uuid`;
  await db.sql`delete from users where id = ${userId}::uuid`;
}

function randomUuid(): string {
  return "00000000-0000-4000-8000-000000000000".replace(/[08]/g, (c) =>
    ((Number(c) ^ (Math.floor(Math.random() * 16) & 15)) >> (Number(c) / 4)).toString(16)
  );
}
