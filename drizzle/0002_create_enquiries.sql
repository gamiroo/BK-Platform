-- Create enquiries table (marketing enquiries)
-- Safe: includes pgcrypto for gen_random_uuid()

create extension if not exists pgcrypto;

create table if not exists enquiries (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  email text not null,
  message text not null,

  zoho_sync_status text not null default 'pending'
    check (zoho_sync_status in ('pending', 'synced', 'failed')),

  zoho_lead_id text null,
  zoho_last_error text null,

  created_at timestamptz not null default now()
);

create index if not exists enquiries_created_at_idx on enquiries (created_at desc);
create index if not exists enquiries_email_idx on enquiries (email);
