-- Phase D: soft locks on open learning sessions (owner teacher + expiry).
-- Prevents two browsers from treating the same open session as exclusively theirs
-- without a hard multi-master protocol.

alter table public.learning_sessions
  add column if not exists owner_user_id uuid references public.users (id),
  add column if not exists lock_expires_at timestamptz;
create index if not exists learning_sessions_open_owner_idx
  on public.learning_sessions (class_id, status)
  where status = 'open';
comment on column public.learning_sessions.owner_user_id is
  'Teacher currently authorized to capture; soft lock with lock_expires_at.';
comment on column public.learning_sessions.lock_expires_at is
  'When the soft lock expires; other teachers may acquire after this time.';
