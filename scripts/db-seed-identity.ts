// scripts/db-seed-identity.ts
/**
 * Seed Identity bootstrap data aligned to core.ts + balance_kitchen_schema.md
 *
 * Seeds:
 * - users (with password_hash)
 * - roles (optional lookup table; not used for auth decisions yet)
 * - accounts (one INTERNAL for admin, one CUSTOMER for client)
 * - account_memberships (admin gets role_key=admin, client gets role_key=client)
 *
 * Idempotent and safe to run repeatedly.
 */

import { createDb } from "../src/shared/db/client.js";
import { hashPassword } from "../src/shared/security/password.js";

function isoNow() {
  return new Date().toISOString();
}

function log(msg: string) {
  console.log(`[db-seed-identity] ${msg}`);
}

type TableShape = Readonly<{
  hasUsersDeletedAt: boolean;
  hasUsersPasswordHash: boolean;
}>;

async function tableHasColumn(sql: ReturnType<typeof createDb>["sql"], table: string, column: string): Promise<boolean> {
  const rows = await sql<{ ok: boolean }[]>`
    select exists(
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${table}
        and column_name = ${column}
    ) as ok
  `;
  return Boolean(rows[0]?.ok);
}

async function assertShape(sql: ReturnType<typeof createDb>["sql"]): Promise<TableShape> {
  const hasUsersPasswordHash = await tableHasColumn(sql, "users", "password_hash");
  if (!hasUsersPasswordHash) {
    throw new Error(
      `[db-seed-identity] users.password_hash missing. Run migrations so users includes password_hash.`
    );
  }

  const hasUsersDeletedAt = await tableHasColumn(sql, "users", "deleted_at");
  return { hasUsersDeletedAt, hasUsersPasswordHash };
}

async function findUserIdByEmailLower(
  sql: ReturnType<typeof createDb>["sql"],
  emailLower: string,
  shape: TableShape
): Promise<string | null> {
  const rows = shape.hasUsersDeletedAt
    ? await sql<{ id: string }[]>`
        select id
        from users
        where lower(email) = ${emailLower}
          and deleted_at is null
        limit 1
      `
    : await sql<{ id: string }[]>`
        select id
        from users
        where lower(email) = ${emailLower}
        limit 1
      `;

  return rows[0]?.id ?? null;
}

async function upsertUser(
  sql: ReturnType<typeof createDb>["sql"],
  input: { email: string; password: string },
  shape: TableShape
): Promise<string> {
  const email = input.email.trim();
  const emailLower = email.toLowerCase();
  const passwordHash = await hashPassword(input.password);

  const existingId = await findUserIdByEmailLower(sql, emailLower, shape);

  if (existingId) {
    await sql`
      update users
      set
        password_hash = ${passwordHash},
        status = 'ACTIVE',
        updated_at = now()
      where id = ${existingId}
    `;
    log(`updated user ${email}`);
    return existingId;
  }

  const inserted = await sql<{ id: string }[]>`
    insert into users (email, password_hash, status, created_at, updated_at)
    values (${email}, ${passwordHash}, 'ACTIVE', now(), now())
    returning id
  `;

  const id = inserted[0]?.id;
  if (!id) throw new Error(`[db-seed-identity] failed to insert user ${email}`);
  log(`inserted user ${email}`);
  return id;
}

async function ensureRoleKey(sql: ReturnType<typeof createDb>["sql"], key: string, description?: string): Promise<void> {
  // roles.key in your core.ts is not declared unique (doc says it should be unique).
  // So we do a manual "select then insert" (safe even without unique constraint).
  const exists = await sql<{ ok: boolean }[]>`
    select exists(select 1 from roles where key = ${key}) as ok
  `;
  if (exists[0]?.ok) return;

  await sql`
    insert into roles (key, description, created_at, updated_at)
    values (${key}, ${description ?? null}, now(), now())
  `;
}

async function ensureAccountForUser(
  sql: ReturnType<typeof createDb>["sql"],
  input: { primaryUserId: string; accountType: "INTERNAL" | "CUSTOMER"; status: "ACTIVE" | "PAUSED" | "SUSPENDED" | "CLOSED" }
): Promise<string> {
  // Keep it deterministic: one active account per primary_user_id per type (for seed).
  // (Schema doc doesn’t define this uniqueness, so we do it manually.)
  const rows = await sql<{ id: string }[]>`
    select id
    from accounts
    where primary_user_id = ${input.primaryUserId}
      and account_type = ${input.accountType}
      and deleted_at is null
    limit 1
  `;
  const existing = rows[0]?.id;
  if (existing) return existing;

  const inserted = await sql<{ id: string }[]>`
    insert into accounts (account_type, status, primary_user_id, created_at, updated_at)
    values (${input.accountType}, ${input.status}, ${input.primaryUserId}, now(), now())
    returning id
  `;
  const id = inserted[0]?.id;
  if (!id) throw new Error(`[db-seed-identity] failed to insert account for user ${input.primaryUserId}`);
  return id;
}

async function ensureMembership(
  sql: ReturnType<typeof createDb>["sql"],
  input: { accountId: string; userId: string; roleKey: "client" | "admin" | "account_manager" | "super_admin" }
): Promise<void> {
  // Schema wants partial unique on (account_id,user_id,role_key) where deleted_at is null.
  // We don’t assume it exists yet; do manual existence check.
  const rows = await sql<{ ok: boolean }[]>`
    select exists(
      select 1
      from account_memberships
      where account_id = ${input.accountId}
        and user_id = ${input.userId}
        and role_key = ${input.roleKey}
        and deleted_at is null
    ) as ok
  `;
  if (rows[0]?.ok) return;

  await sql`
    insert into account_memberships (account_id, user_id, role_key, created_at, updated_at)
    values (${input.accountId}, ${input.userId}, ${input.roleKey}, now(), now())
  `;
}

async function main(): Promise<void> {
  const h = createDb();
  try {
    log(`started ${isoNow()}`);

    const shape = await assertShape(h.sql);

    // 1) Users (credential auth)
    const adminUserId = await upsertUser(h.sql, { email: "admin@balance.local", password: "admin_password" }, shape);
    const clientUserId = await upsertUser(h.sql, { email: "client@balance.local", password: "client_password" }, shape);

    // 2) Role lookup table (optional today, but matches schema doc)
    await ensureRoleKey(h.sql, "client", "Client user");
    await ensureRoleKey(h.sql, "admin", "Admin user");
    await ensureRoleKey(h.sql, "account_manager", "Account manager");
    await ensureRoleKey(h.sql, "super_admin", "Super admin");

    // 3) Accounts + memberships (THIS is what makes admin login succeed)
    const adminAccountId = await ensureAccountForUser(h.sql, {
      primaryUserId: adminUserId,
      accountType: "INTERNAL",
      status: "ACTIVE",
    });
    const clientAccountId = await ensureAccountForUser(h.sql, {
      primaryUserId: clientUserId,
      accountType: "CUSTOMER",
      status: "ACTIVE",
    });

    await ensureMembership(h.sql, { accountId: adminAccountId, userId: adminUserId, roleKey: "admin" });
    await ensureMembership(h.sql, { accountId: clientAccountId, userId: clientUserId, roleKey: "client" });

    log("done");
  } finally {
    await h.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
