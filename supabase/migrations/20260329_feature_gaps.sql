-- Feature Gaps & Enhancements Migration

-- 1. Sync Exclusions Table
create table if not exists public.sync_exclusions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_email_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_email_id)
);

create index if not exists idx_sync_exclusions_user_email on public.sync_exclusions(user_id, source_email_id);

-- 2. Job Applications Enhancements
alter table public.job_applications 
add column if not exists platform text,
add column if not exists resume_version_id uuid references public.resume_versions(id) on delete set null;

-- 3. RLS for sync_exclusions
alter table public.sync_exclusions enable row level security;

create policy "Users can manage their own sync exclusions"
  on public.sync_exclusions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
