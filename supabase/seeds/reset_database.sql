-- Disable triggers to allow administrative updates on published package details
alter table public.test_package_versions disable trigger trg_freeze_published_package_version;
alter table public.narration_variants disable trigger trg_ensure_narration_parent_version_is_draft;
alter table public.test_sections disable trigger trg_ensure_section_parent_version_is_draft;
alter table public.test_items disable trigger trg_ensure_item_parent_version_is_draft;
alter table public.section_measurement_snapshots disable trigger trg_prevent_measurement_snapshot_rewrite;

-- Clear transactional and learner tracking data
delete from public.attendance_records;
delete from public.assessment_events;
delete from public.assessment_attempt_snapshots;
delete from public.assessment_attempts;
delete from public.session_questions;
delete from public.learning_sessions;
delete from public.scheduled_sessions;
delete from public.schedule_definitions;
delete from public.enrollments;
delete from public.classes;
delete from public.courses;
delete from public.learner_access_tokens;

-- Clear standalone test tracking data
delete from public.standalone_test_attempt_snapshots;
delete from public.standalone_test_events;
delete from public.standalone_test_attempts;
delete from public.standalone_test_run_items;
delete from public.standalone_test_runs;
delete from public.standalone_test_assignments;
delete from public.test_catalog_import_runs;

-- Disconnect users from metadata tables before deletion to prevent foreign key errors
update public.test_packages set created_by_user_id = null;
update public.test_package_versions set created_by_user_id = null, published_by_user_id = null;
update public.cci_profiles set created_by_user_id = null;
update public.section_measurement_snapshots set created_by_user_id = null;
update public.narration_variants set approved_by_user_id = null;
update public.generation_jobs set requested_by_user_id = null;
update public.live_test_v2_migration_runs set created_by_user_id = null;

-- Delete old auth and public user records
delete from public.staff_roles;
delete from public.organization_memberships;
delete from public.users;
delete from auth.users;

-- Insert clean admin and chunker users into public.users with stable UUIDs
insert into public.users (id, email, username, display_name, account_status, allow_multi_class) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'admin@example.com', 'admin', 'Admin', 'active', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'admin@chunks.lms', 'admin-local', 'Admin', 'active', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'chunker@example.com', 'chunker', 'Chunker', 'active', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'chunker@chunks.lms', 'chunker-local', 'Chunker', 'active', true);

-- Insert into auth.users (triggers will link auth_user_id)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, recovery_token,
  email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data,
  is_anonymous, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1',
    'authenticated',
    'authenticated',
    'admin@example.com',
    extensions.crypt('admin123', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"email_verified": true, "phone_verified": false}'::jsonb,
    false,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2',
    'authenticated',
    'authenticated',
    'admin@chunks.lms',
    extensions.crypt('admin123', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"email_verified": true, "phone_verified": false}'::jsonb,
    false,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3',
    'authenticated',
    'authenticated',
    'chunker@example.com',
    extensions.crypt('chunker123', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"email_verified": true, "phone_verified": false}'::jsonb,
    false,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4',
    'authenticated',
    'authenticated',
    'chunker@chunks.lms',
    extensions.crypt('chunker123', extensions.gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"email_verified": true, "phone_verified": false}'::jsonb,
    false,
    now(),
    now()
  );

-- Insert corresponding email provider identities so password sign-in works with GoTrue.
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  au.id,
  au.id::text,
  jsonb_build_object(
    'sub', au.id::text,
    'email', au.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
from auth.users au
where lower(au.email) in (
  'admin@example.com',
  'admin@chunks.lms',
  'chunker@example.com',
  'chunker@chunks.lms'
);

-- Assign admin and teacher roles in public.staff_roles (done after auth.users insert so no trigger side-effects happen)
insert into public.staff_roles (user_id, role, active) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'admin', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'teacher', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'admin', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'teacher', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'admin', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'teacher', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'admin', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'teacher', true);

-- Grant memberships to all 5 workspaces (done after staff_roles to maintain consistent setup)
insert into public.organization_memberships (organization_id, user_id, role)
select org.id, usr.id, 'admin'
from public.organizations org, (
  select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid as id union all
  select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid union all
  select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'::uuid union all
  select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4'::uuid
) usr;

-- Re-enable triggers
alter table public.test_package_versions enable trigger trg_freeze_published_package_version;
alter table public.narration_variants enable trigger trg_ensure_narration_parent_version_is_draft;
alter table public.test_sections enable trigger trg_ensure_section_parent_version_is_draft;
alter table public.test_items enable trigger trg_ensure_item_parent_version_is_draft;
alter table public.section_measurement_snapshots enable trigger trg_prevent_measurement_snapshot_rewrite;
