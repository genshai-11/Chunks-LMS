-- Track buổi index (1..N) on scheduled + learning sessions
alter table public.scheduled_sessions
  add column if not exists session_number integer
  check (session_number is null or session_number > 0);

alter table public.learning_sessions
  add column if not exists session_number integer
  check (session_number is null or session_number > 0);

comment on column public.scheduled_sessions.session_number is
  '1-based class meeting index within course plan (Buổi 1..15)';

comment on column public.learning_sessions.session_number is
  '1-based meeting index for progress compare charts';
