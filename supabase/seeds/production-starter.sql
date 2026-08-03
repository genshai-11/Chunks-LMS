-- Production starter (Phase E) — IDEMPOTENT, non-destructive.
-- Safe to re-run: ON CONFLICT DO NOTHING / DO UPDATE only on starter IDs.
-- NEVER use this as a substitute for "db reset". Does not TRUNCATE or DELETE.
--
-- After apply: open Admin UI and replace demo names/emails with real people,
-- or edit the values below before first run.
--
-- Fixed UUIDs are namespaced for the starter org only.

-- ---------------------------------------------------------------------------
-- Organization
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, clerk_org_id)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'Chunks Production Starter',
  'org_prod_starter'
)
on conflict (id) do nothing;

-- If clerk_org_id unique conflict on re-run with different id, ignore:
-- (no-op when already present)

-- ---------------------------------------------------------------------------
-- Placeholder people (replace emails before sharing invites)
-- Staff authenticate through native Supabase Auth; these rows pre-provision domain profiles/roles.
-- ---------------------------------------------------------------------------
insert into public.users (id, clerk_user_id, display_name, email, username) values
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'local_prod_admin',
    'Starter Admin',
    'admin@example.com',
    'starter-admin'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'local_prod_teacher',
    'Starter Teacher',
    'teacher@example.com',
    'starter-teacher'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
    'local_prod_learner_1',
    'Starter Learner 1',
    'learner1@example.com',
    null
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4',
    'local_prod_learner_2',
    'Starter Learner 2',
    'learner2@example.com',
    null
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5',
    'local_prod_learner_3',
    'Starter Learner 3',
    'learner3@example.com',
    null
  )
on conflict (id) do nothing;

insert into public.organization_memberships (organization_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'admin'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'teacher'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'learner'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'learner'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5', 'learner')
on conflict (organization_id, user_id, role) do nothing;

-- ---------------------------------------------------------------------------
-- Course + class + enrollments
-- ---------------------------------------------------------------------------
insert into public.courses (id, organization_id, code, name, status, starts_on, ends_on)
values (
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'ERE-Level-B',
  'ERE Level B',
  'active',
  current_date,
  current_date + 120
)
on conflict (id) do nothing;

insert into public.classes (id, course_id, name, capacity, teacher_user_id, status)
values (
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'Class B-1',
  3,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'active'
)
on conflict (id) do nothing;

-- Insert one-by-one via NOT EXISTS so capacity trigger is not tripped on re-runs
insert into public.enrollments (class_id, learner_user_id, status)
select 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'active'
where not exists (
  select 1 from public.enrollments
  where class_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
    and learner_user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'
);

insert into public.enrollments (class_id, learner_user_id, status)
select 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'active'
where not exists (
  select 1 from public.enrollments
  where class_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
    and learner_user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4'
);

insert into public.enrollments (class_id, learner_user_id, status)
select 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5', 'active'
where not exists (
  select 1 from public.enrollments
  where class_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
    and learner_user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5'
);

-- ---------------------------------------------------------------------------
-- Org metric settings defaults (if table exists from Phase C migration)
-- ---------------------------------------------------------------------------
insert into public.org_settings (organization_id, default_max_probe_count, metric_settings)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  2,
  '[]'::jsonb
)
on conflict (organization_id) do nothing;

-- Done. Next: staff Clerk sign-in → Admin UI → real emails → invite links → Day 1.
