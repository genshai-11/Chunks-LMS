-- Account active/inactive for teacher & learner profiles; session kind + participants.

alter table public.users
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'inactive'));

comment on column public.users.account_status is
  'Admin-managed availability: inactive accounts keep history but cannot be newly seated / invited as active.';

alter table public.learning_sessions
  add column if not exists session_kind text not null default 'regular'
    check (session_kind in ('regular', 'pretest', 'posttest')),
  add column if not exists participant_learner_ids uuid[] null;

comment on column public.learning_sessions.session_kind is
  'pretest/posttest for baseline RFC comparison; regular for day teaching.';

comment on column public.learning_sessions.participant_learner_ids is
  'Optional subset of class learners for multi-select capture; null = all active enrollments at start.';
