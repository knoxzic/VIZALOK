-- Expense IQ™ — Capture / Transactions / Bookings & Tasks migration
-- Run once in Supabase SQL Editor, after schema.sql has already been applied.
-- Purely additive and idempotent — safe to re-run.

-- ---------------------------------------------------------------------------
-- eiq_receipts: give the bare stub real columns
-- ---------------------------------------------------------------------------

alter table public.eiq_receipts
  add column if not exists vendor text,
  add column if not exists date date,
  add column if not exists total numeric(12, 2) not null default 0,
  add column if not exists category text,
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists engine text,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_at timestamptz;

create index if not exists eiq_receipts_org_date_idx
  on public.eiq_receipts (org_id, date desc);

-- RLS + eiq_rc_all policy already exist from schema.sql — no change needed.

-- ---------------------------------------------------------------------------
-- eiq_tasks: new table (Bookings & Tasks module)
-- ---------------------------------------------------------------------------

create table if not exists public.eiq_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.eiq_organizations (org_id) on delete cascade,
  type text not null default 'task' check (type in ('task', 'booking')),
  title text not null,
  date date,
  time time,
  notes text,
  done boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists eiq_tasks_org_date_idx
  on public.eiq_tasks (org_id, date, time);

alter table public.eiq_tasks enable row level security;

drop policy if exists eiq_tasks_all on public.eiq_tasks;
create policy eiq_tasks_all on public.eiq_tasks
  for all using (public.eiq_is_org_member(org_id))
  with check (public.eiq_is_org_member(org_id));
