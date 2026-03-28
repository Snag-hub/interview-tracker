-- Run this after supabase/schema.sql

-- Keep updated_at consistent
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute procedure public.set_updated_at();

drop trigger if exists set_gmail_accounts_updated_at on public.gmail_accounts;
create trigger set_gmail_accounts_updated_at
before update on public.gmail_accounts
for each row execute procedure public.set_updated_at();

drop trigger if exists set_job_applications_updated_at on public.job_applications;
create trigger set_job_applications_updated_at
before update on public.job_applications
for each row execute procedure public.set_updated_at();

drop trigger if exists set_resume_versions_updated_at on public.resume_versions;
create trigger set_resume_versions_updated_at
before update on public.resume_versions
for each row execute procedure public.set_updated_at();

drop trigger if exists set_interview_rounds_updated_at on public.interview_rounds;
create trigger set_interview_rounds_updated_at
before update on public.interview_rounds
for each row execute procedure public.set_updated_at();

-- Enable RLS
alter table public.subscriptions enable row level security;
alter table public.gmail_accounts enable row level security;
alter table public.job_applications enable row level security;
alter table public.resume_versions enable row level security;
alter table public.interview_rounds enable row level security;
alter table public.sync_runs enable row level security;

-- subscriptions
drop policy if exists subscriptions_owner_all on public.subscriptions;
create policy subscriptions_owner_all
on public.subscriptions
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- gmail_accounts
drop policy if exists gmail_accounts_owner_all on public.gmail_accounts;
create policy gmail_accounts_owner_all
on public.gmail_accounts
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- job_applications
drop policy if exists job_applications_owner_all on public.job_applications;
create policy job_applications_owner_all
on public.job_applications
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- resume_versions
drop policy if exists resume_versions_owner_all on public.resume_versions;
create policy resume_versions_owner_all
on public.resume_versions
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- sync_runs
drop policy if exists sync_runs_owner_all on public.sync_runs;
create policy sync_runs_owner_all
on public.sync_runs
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- interview_rounds follow ownership from parent application
drop policy if exists interview_rounds_owner_all on public.interview_rounds;
create policy interview_rounds_owner_all
on public.interview_rounds
for all
to authenticated
using (
  exists (
    select 1
    from public.job_applications applications
    where applications.id = interview_rounds.application_id
      and applications.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.job_applications applications
    where applications.id = interview_rounds.application_id
      and applications.user_id = auth.uid()
  )
);

-- Seed trial subscription row when a user signs up
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (user_id, plan_code, status, trial_ends_at)
  values (new.id, 'pro_monthly', 'trialing', now() + interval '14 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();
