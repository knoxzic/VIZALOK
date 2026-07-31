-- Expense IQ™ — multi-tenant schema for Supabase
-- Run once in Supabase SQL Editor (Dashboard → SQL → New query).
-- Each user owns data only for orgs they belong to (RLS).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.eiq_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  mfa_enabled boolean not null default false,
  mfa_secret text,
  created_at timestamptz not null default now()
);

create table if not exists public.eiq_organizations (
  org_id uuid primary key default gen_random_uuid(),
  org_name text not null,
  org_type text not null,
  coa_template text not null,
  ein text not null default '',
  fiscal_year_start date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.eiq_org_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references public.eiq_organizations (org_id) on delete cascade,
  role text not null,
  joined_at timestamptz not null default now(),
  unique (user_id, org_id)
);

create index if not exists eiq_org_members_user_idx on public.eiq_org_members (user_id);
create index if not exists eiq_org_members_org_idx on public.eiq_org_members (org_id);

create table if not exists public.eiq_audit_log (
  log_id uuid primary key default gen_random_uuid(),
  org_id uuid,
  user_id uuid,
  action text not null,
  entity_type text,
  entity_id text,
  before_value jsonb,
  after_value jsonb,
  "timestamp" timestamptz not null default now()
);

create index if not exists eiq_audit_org_idx on public.eiq_audit_log (org_id);

-- Phase 2+ ledger stubs (org-scoped; empty until modules ship)
create table if not exists public.eiq_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.eiq_organizations (org_id) on delete cascade,
  status text not null default 'draft',
  amount numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.eiq_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.eiq_organizations (org_id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.eiq_grants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.eiq_organizations (org_id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.eiq_mileage_trips (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.eiq_organizations (org_id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.eiq_is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.eiq_org_members m
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.eiq_is_org_owner(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.eiq_org_members m
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

-- Auto-profile on signup
create or replace function public.eiq_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.eiq_profiles (user_id, email, display_name)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, 'user'), '@', 1))
  )
  on conflict (user_id) do update
    set email = excluded.email,
        display_name = coalesce(public.eiq_profiles.display_name, excluded.display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_eiq on auth.users;
create trigger on_auth_user_created_eiq
  after insert on auth.users
  for each row execute function public.eiq_handle_new_user();

-- Atomic org bootstrap (owner membership + audit)
create or replace function public.eiq_create_organization(
  p_org_name text,
  p_org_type text,
  p_coa_template text,
  p_ein text default '',
  p_fiscal_year_start date default null
)
returns public.eiq_organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org public.eiq_organizations;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if length(trim(coalesce(p_org_name, ''))) < 1 then
    raise exception 'Organization name is required';
  end if;

  insert into public.eiq_organizations (
    org_name, org_type, coa_template, ein, fiscal_year_start, created_by
  )
  values (
    trim(p_org_name),
    p_org_type,
    p_coa_template,
    coalesce(trim(p_ein), ''),
    p_fiscal_year_start,
    v_uid
  )
  returning * into v_org;

  insert into public.eiq_org_members (user_id, org_id, role)
  values (v_uid, v_org.org_id, 'owner');

  insert into public.eiq_audit_log (org_id, user_id, action, entity_type, entity_id, after_value)
  values (
    v_org.org_id,
    v_uid,
    'create',
    'organization',
    v_org.org_id::text,
    jsonb_build_object(
      'org_name', v_org.org_name,
      'org_type', v_org.org_type,
      'coa_template', v_org.coa_template
    )
  );

  return v_org;
end;
$$;

create or replace function public.eiq_invite_member(
  p_org_id uuid,
  p_email text,
  p_role text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_email text := lower(trim(p_email));
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.eiq_is_org_owner(p_org_id) then
    raise exception 'Only owners can invite members';
  end if;
  if p_role is null or p_role = 'owner' then
    raise exception 'Invalid role for invite';
  end if;

  select user_id into v_target
  from public.eiq_profiles
  where email = v_email
  limit 1;

  if v_target is null then
    raise exception 'User must create an Expense IQ account first, then invite by email.';
  end if;

  if exists (
    select 1 from public.eiq_org_members
    where org_id = p_org_id and user_id = v_target
  ) then
    raise exception 'User is already a member of this organization.';
  end if;

  insert into public.eiq_org_members (user_id, org_id, role)
  values (v_target, p_org_id, p_role);

  insert into public.eiq_audit_log (org_id, user_id, action, entity_type, entity_id, after_value)
  values (
    p_org_id,
    v_uid,
    'permission_change',
    'org_users',
    v_target::text,
    jsonb_build_object('email', v_email, 'role', p_role)
  );

  return true;
end;
$$;

grant execute on function public.eiq_create_organization(text, text, text, text, date) to authenticated;
grant execute on function public.eiq_invite_member(uuid, text, text) to authenticated;
grant execute on function public.eiq_is_org_member(uuid) to authenticated;
grant execute on function public.eiq_is_org_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.eiq_profiles enable row level security;
alter table public.eiq_organizations enable row level security;
alter table public.eiq_org_members enable row level security;
alter table public.eiq_audit_log enable row level security;
alter table public.eiq_transactions enable row level security;
alter table public.eiq_receipts enable row level security;
alter table public.eiq_grants enable row level security;
alter table public.eiq_mileage_trips enable row level security;

-- Profiles
drop policy if exists eiq_profiles_select_own on public.eiq_profiles;
drop policy if exists eiq_profiles_update_own on public.eiq_profiles;
drop policy if exists eiq_profiles_insert_own on public.eiq_profiles;
drop policy if exists eiq_profiles_select_org_peers on public.eiq_profiles;

create policy eiq_profiles_select_own on public.eiq_profiles
  for select using (auth.uid() = user_id);

create policy eiq_profiles_select_org_peers on public.eiq_profiles
  for select using (
    exists (
      select 1
      from public.eiq_org_members me
      join public.eiq_org_members them on them.org_id = me.org_id
      where me.user_id = auth.uid()
        and them.user_id = eiq_profiles.user_id
    )
  );

create policy eiq_profiles_update_own on public.eiq_profiles
  for update using (auth.uid() = user_id);

create policy eiq_profiles_insert_own on public.eiq_profiles
  for insert with check (auth.uid() = user_id);

-- Organizations
drop policy if exists eiq_orgs_select on public.eiq_organizations;
drop policy if exists eiq_orgs_insert on public.eiq_organizations;
drop policy if exists eiq_orgs_update on public.eiq_organizations;

create policy eiq_orgs_select on public.eiq_organizations
  for select using (public.eiq_is_org_member(org_id));

create policy eiq_orgs_insert on public.eiq_organizations
  for insert with check (auth.uid() = created_by);

create policy eiq_orgs_update on public.eiq_organizations
  for update using (public.eiq_is_org_owner(org_id));

-- Members
drop policy if exists eiq_members_select on public.eiq_org_members;
drop policy if exists eiq_members_insert on public.eiq_org_members;

create policy eiq_members_select on public.eiq_org_members
  for select using (public.eiq_is_org_member(org_id));

create policy eiq_members_insert on public.eiq_org_members
  for insert with check (
    auth.uid() = user_id
    or public.eiq_is_org_owner(org_id)
  );

-- Audit
drop policy if exists eiq_audit_select on public.eiq_audit_log;
drop policy if exists eiq_audit_insert on public.eiq_audit_log;

create policy eiq_audit_select on public.eiq_audit_log
  for select using (org_id is null or public.eiq_is_org_member(org_id));

create policy eiq_audit_insert on public.eiq_audit_log
  for insert with check (
    user_id = auth.uid()
    and (org_id is null or public.eiq_is_org_member(org_id))
  );

-- Ledger stubs
drop policy if exists eiq_tx_all on public.eiq_transactions;
drop policy if exists eiq_rc_all on public.eiq_receipts;
drop policy if exists eiq_gr_all on public.eiq_grants;
drop policy if exists eiq_mi_all on public.eiq_mileage_trips;

create policy eiq_tx_all on public.eiq_transactions
  for all using (public.eiq_is_org_member(org_id))
  with check (public.eiq_is_org_member(org_id));

create policy eiq_rc_all on public.eiq_receipts
  for all using (public.eiq_is_org_member(org_id))
  with check (public.eiq_is_org_member(org_id));

create policy eiq_gr_all on public.eiq_grants
  for all using (public.eiq_is_org_member(org_id))
  with check (public.eiq_is_org_member(org_id));

create policy eiq_mi_all on public.eiq_mileage_trips
  for all using (public.eiq_is_org_member(org_id))
  with check (public.eiq_is_org_member(org_id));
