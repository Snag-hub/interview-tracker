-- Personal Interview Tracker SaaS - initial schema

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'application_status') then
    create type application_status as enum ('Applied', 'Shortlisted', 'Interviewing', 'Offer', 'Rejected', 'OnHold');
  end if;

  if not exists (select 1 from pg_type where typname = 'stage_type') then
    create type stage_type as enum ('None', 'HR', 'L1', 'L2', 'Managerial', 'Final');
  end if;

  if not exists (select 1 from pg_type where typname = 'round_status') then
    create type round_status as enum ('Scheduled', 'Completed', 'Canceled', 'Rescheduled', 'NoShow');
  end if;

  if not exists (select 1 from pg_type where typname = 'round_type') then
    create type round_type as enum ('HR', 'L1', 'L2', 'Managerial', 'Final', 'Other');
  end if;

  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete');
  end if;

  if not exists (select 1 from pg_type where typname = 'sync_status') then
    create type sync_status as enum ('success', 'partial', 'failed');
  end if;
end $$;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_code text,
  status subscription_status not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gmail_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  google_email text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  token_expiry timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  company text not null,
  role text not null,
  application_status application_status not null default 'Applied',
  current_stage stage_type not null default 'None',
  applied_date date,
  job_posting_url text,
  jd_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  version_label text not null,
  resume_url text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interview_rounds (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications(id) on delete cascade,
  round_type round_type not null,
  scheduled_start_utc timestamptz not null,
  scheduled_end_utc timestamptz,
  timezone text,
  status round_status not null default 'Scheduled',
  meeting_link text,
  organizer_email text,
  attendee_emails text[] not null default '{}',
  source_email_id text,
  source_thread_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status sync_status not null,
  fetched_count integer not null default 0,
  parsed_count integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  failed_count integer not null default 0,
  error_summary text
);

create table if not exists public.parser_resolutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  signature text not null,
  company text not null,
  role text not null,
  confidence numeric(5,4) not null default 0,
  source text not null default 'gemini',
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, signature)
);

create table if not exists public.sync_review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  sync_run_id uuid references public.sync_runs(id) on delete set null,
  source_email_id text,
  source_thread_id text,
  signature text,
  application_id uuid references public.job_applications(id) on delete set null,
  raw_subject text not null,
  raw_from text,
  raw_snippet text,
  proposed_company text not null,
  proposed_role text not null,
  proposed_round_type round_type,
  proposed_status round_status,
  parser_source text not null default 'rule',
  confidence numeric(5,4) not null default 0,
  reason text,
  ai_used boolean not null default false,
  review_status text not null default 'pending',
  resolved_company text,
  resolved_role text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sync_review_items_status_check check (review_status in ('pending', 'applied', 'dismissed'))
);

create index if not exists idx_interview_rounds_application_start
  on public.interview_rounds(application_id, scheduled_start_utc);

create index if not exists idx_interview_rounds_source_email
  on public.interview_rounds(source_email_id);

create index if not exists idx_job_applications_user_updated
  on public.job_applications(user_id, updated_at desc);

create index if not exists idx_subscriptions_user_id
  on public.subscriptions(user_id);

create index if not exists idx_parser_resolutions_user_used
  on public.parser_resolutions(user_id, last_used_at desc);

create index if not exists idx_sync_review_items_user_status_created
  on public.sync_review_items(user_id, review_status, created_at desc);

create index if not exists idx_sync_review_items_thread
  on public.sync_review_items(user_id, source_thread_id);

create index if not exists idx_sync_review_items_signature
  on public.sync_review_items(user_id, signature);
