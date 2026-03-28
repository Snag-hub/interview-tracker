alter table public.interview_rounds
  add column if not exists organizer_email text;

alter table public.interview_rounds
  add column if not exists attendee_emails text[] not null default '{}';
