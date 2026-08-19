-- Voice agent deferred — schema stub only (no provider integration offline)

create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  submission_id uuid,
  direction text,
  phone text,
  transcript text,
  summary text,
  outcome text,
  next_step text
);

alter table public.call_logs enable row level security;

-- No public access; staff policies can be added when voice ships
drop policy if exists "call_logs_staff_all" on public.call_logs;
create policy "call_logs_staff_all"
  on public.call_logs for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'staff')
    )
  );
