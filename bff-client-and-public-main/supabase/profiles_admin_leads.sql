-- BFF staff roles + lead review (offline-safe migration; run in Supabase SQL editor when ready)
-- Does not replace public_leads insert policy.

-- Profiles for admin/staff gating (RLS is the real security for static admin HTML)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'staff', 'admin')),
  display_name text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
  on public.profiles for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'staff')
    )
  );

-- Optional notes column for staff on leads
alter table public.leads
  add column if not exists staff_notes text;

alter table public.leads
  add column if not exists status text default 'new';

-- Staff/admin can read & update leads (tighten of authenticated-all)
drop policy if exists "leads_staff_select" on public.leads;
create policy "leads_staff_select"
  on public.leads for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'staff')
    )
  );

drop policy if exists "leads_staff_update" on public.leads;
create policy "leads_staff_update"
  on public.leads for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'staff')
    )
  );

-- After first staff signup: insert profile row
-- insert into public.profiles (id, role, display_name) values ('YOUR_USER_UUID', 'admin', 'Staff');
