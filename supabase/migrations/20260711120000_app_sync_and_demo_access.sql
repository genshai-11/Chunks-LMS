-- App sync: course schedule JSON, user avatar, and foundation demo RLS
-- (open access for anon/authenticated until Clerk third-party JWT is production-wired)

alter table public.courses
  add column if not exists schedule jsonb;

alter table public.users
  add column if not exists avatar_url text;

comment on column public.courses.schedule is
  'Auto-schedule: { weekdays, startTime, durationMinutes, sessionCount, timeZone }';

comment on column public.users.avatar_url is
  'Optional avatar image URL or data URL';

-- ---------------------------------------------------------------------------
-- Foundation demo policies: allow full CRUD for local Vite app using anon key.
-- Tighten when Clerk session JWT is required in production.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations',
    'users',
    'organization_memberships',
    'courses',
    'classes',
    'enrollments',
    'schedule_definitions',
    'scheduled_sessions',
    'learning_sessions',
    'attendance_records',
    'session_questions',
    'assessment_attempts',
    'assessment_events',
    'assessment_attempt_snapshots'
  ]
  loop
    execute format(
      'drop policy if exists demo_all_%I on public.%I',
      t, t
    );
    execute format(
      'create policy demo_all_%I on public.%I for all using (true) with check (true)',
      t, t
    );
  end loop;
end $$;
