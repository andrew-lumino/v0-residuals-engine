-- Enable UUID extension
create extension if not exists "pgcrypto";

-- 1. Merchants Table
create table if not exists public.merchants (
  id uuid not null default gen_random_uuid(),
  merchant_id text null,
  dba_name text null,
  legal_name text null,
  mid text null,
  primary_email text null,
  status text not null default 'active',
  account_assignment_status text not null default 'available',
  assigned_agent_id uuid null,
  tier integer null,
  boarding_platform text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  available_to_purchase boolean not null default true,
  constraint merchants_pkey primary key (id),
  constraint merchants_mid_key unique (mid)
);

-- 2. Partner Sync Table (Airtable Source)
create table if not exists public.partner_sync (
  id uuid not null default gen_random_uuid(),
  airtable_record_id text not null,
  name text not null,
  email text null,
  role text null,
  default_payout_type text null default 'residual',
  default_split_pct numeric(5,2) null,
  last_synced_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  is_active boolean not null default true,
  notes text null,
  constraint partner_sync_pkey primary key (id),
  constraint partner_sync_airtable_id_key unique (airtable_record_id)
);

-- 3. Deals Table (Logic for Splits)
create table if not exists public.deals (
  id uuid not null default gen_random_uuid(),
  deal_id text null,
  merchant_id uuid null,
  mid text null,
  effective_date date null,
  plan text null,
  payout_type text null default 'residual',
  participants_json jsonb not null default '[]'::jsonb,
  assigned_agent_name text null,
  assigned_at timestamp with time zone null,
  partner_id text null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  available_to_purchase boolean not null default false,
  constraint deals_pkey primary key (id),
  -- Each MID can have multiple deals (one per payout_type: residual, bonus, trueup, clawback, etc.)
  constraint deals_mid_payout_type_idx unique (mid, payout_type)
);

-- 4. CSV Data Table (Imported Events)
create table if not exists public.csv_data (
  id uuid not null default gen_random_uuid(),
  batch_id uuid null,
  merchant_name text null,
  mid text null,
  volume numeric(12,2) null default 0,
  fees numeric(12,2) null default 0,
  date date null,
  payout_month text null,
  assigned_agent_id text null,
  assigned_agent_name text null,
  deal_id uuid null,
  status text null,
  assignment_status text not null default 'unassigned',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  row_hash text null,
  adjustments numeric(12,2) null default 0,
  chargebacks numeric(12,2) null default 0,
  raw_data jsonb null,
  is_held boolean not null default false,
  hold_reason text null,
  airtable_synced boolean not null default false,
  payout_type text not null default 'residual',
  adjustment_type text null,
  adjusts_payout_id uuid null,
  paid_at timestamp with time zone null,
  paid_by uuid null,
  paid_status text not null default 'unpaid',
  constraint csv_data_pkey primary key (id),
  constraint csv_data_row_hash_key unique (row_hash)
);

-- 5. Payouts Table (Calculated Results)
create table if not exists public.payouts (
  id uuid not null default gen_random_uuid(),
  csv_data_id uuid not null,
  deal_id text null,
  merchant_id uuid null,
  payout_month text null,
  payout_date date null,
  mid text null,
  merchant_name text null,
  payout_type text null,
  volume numeric(12, 2) null default 0,
  fees numeric(12, 2) null default 0,
  adjustments numeric(12, 2) null default 0,
  chargebacks numeric(12, 2) null default 0,
  net_residual numeric(12, 2) null default 0,
  partner_airtable_id text null,
  partner_role text null,
  partner_split_pct numeric(5, 2) null,
  partner_payout_amount numeric(12, 2) null,
  deal_plan text null,
  assignment_status text null default 'confirmed'::text,
  paid_status text null default 'unpaid'::text,
  paid_at timestamp with time zone null,
  batch_id uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint payouts_pkey primary key (id),
  constraint payouts_unique_partner_payout unique (csv_data_id, partner_airtable_id),
  constraint payouts_csv_data_id_fkey foreign KEY (csv_data_id) references csv_data (id) on delete CASCADE
);

-- Indexes for Performance
create index if not exists idx_csv_data_mid on public.csv_data(mid);
create index if not exists idx_csv_data_status on public.csv_data(assignment_status);
create index if not exists idx_csv_data_month on public.csv_data(payout_month);

create index if not exists idx_deals_mid on public.deals(mid);

create index if not exists idx_payouts_csv_data_id on public.payouts(csv_data_id);
create index if not exists idx_payouts_partner_airtable_id on public.payouts(partner_airtable_id);
create index if not exists idx_payouts_payout_month on public.payouts(payout_month);
