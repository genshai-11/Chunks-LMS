BEGIN;
SELECT plan(16);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('11000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'catalog-admin@example.com', crypt('password', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('11000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'catalog-teacher@example.com', crypt('password', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.organizations (id, name) values
  ('21000000-0000-4000-8000-000000000001', 'Chunks Workspace');
insert into public.users (id, auth_user_id, display_name, email) values
  ('31000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'Catalog Admin', 'catalog-admin@example.com'),
  ('31000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000002', 'Catalog Teacher', 'catalog-teacher@example.com');
insert into public.staff_roles (user_id, role, active) values
  ('31000000-0000-4000-8000-000000000001', 'admin', true),
  ('31000000-0000-4000-8000-000000000002', 'teacher', true);
insert into public.courses (id, organization_id, code, name)
values ('32000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'CAT', 'Catalog Course');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);

insert into public.test_packages (id, organization_id, title, slug, created_by_user_id)
values ('41000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'Flexible Package', 'flexible-package', '31000000-0000-4000-8000-000000000001');
insert into public.test_package_versions (id, package_id, version_label, created_by_user_id)
values ('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', '1.0.0', '31000000-0000-4000-8000-000000000001');
insert into public.cci_profiles (id, organization_id, name, version_label, status, created_by_user_id)
values ('43000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'Default CCI', '1.0.0', 'draft', '31000000-0000-4000-8000-000000000001');
insert into public.cci_categories (id, profile_id, category_order, label, value)
values ('44000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', 1, 'Current 5', 5);
insert into public.test_sections (id, package_version_id, section_order, title, target_cvr_ohm, cci_profile_id, cci_category_id, cci_snapshot)
values (
  '45000000-0000-4000-8000-000000000001',
  '42000000-0000-4000-8000-000000000001',
  1,
  'Section One',
  12,
  '43000000-0000-4000-8000-000000000001',
  '44000000-0000-4000-8000-000000000001',
  '{"label":"Current 5","value":5}'::jsonb
);
insert into public.section_measurement_snapshots (id, test_section_id, package_version_id, target_cvr_ohm, cci_profile_id, cci_category_id, cci_category_label, cci_value, created_by_user_id)
values (
  '46000000-0000-4000-8000-000000000001',
  '45000000-0000-4000-8000-000000000001',
  '42000000-0000-4000-8000-000000000001',
  12,
  '43000000-0000-4000-8000-000000000001',
  '44000000-0000-4000-8000-000000000001',
  'Current 5',
  5,
  '31000000-0000-4000-8000-000000000001'
);
insert into public.test_items (id, package_version_id, section_id, item_order, prompt_vi, prompt_en, tc, lc, tl)
select
  ('47000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  '42000000-0000-4000-8000-000000000001',
  '45000000-0000-4000-8000-000000000001',
  i,
  'Câu ' || i,
  'Sentence ' || i,
  2,
  i,
  3
from generate_series(1, 12) as g(i);

select is((select count(*)::int from public.test_items where section_id = '45000000-0000-4000-8000-000000000001'), 12, 'Flexible Test Section can store more than ten Test Items');
select is((select measured_cvr from public.test_items where item_order = 4), 24::numeric, 'measured_cvr is generated from TC x LC x TL');
select is((select target_cvr_ohm from public.section_measurement_snapshots where id = '46000000-0000-4000-8000-000000000001'), 12::numeric, 'section target_cvr_ohm remains section-level');
select is((select cci_value from public.section_measurement_snapshots where id = '46000000-0000-4000-8000-000000000001'), 5::numeric, 'CCI value is snapshotted from CCI Category');

update public.test_package_versions
set status = 'published', snapshot_hash = 'sha256:published-snapshot', published_by_user_id = '31000000-0000-4000-8000-000000000001'
where id = '42000000-0000-4000-8000-000000000001';
update public.cci_profiles set status = 'active' where id = '43000000-0000-4000-8000-000000000001';

select throws_ok(
  $$update public.test_items set prompt_en = 'Mutated' where id = '47000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'Published Package Versions are immutable',
  'Published Test Items cannot be mutated'
);
select throws_ok(
  $$update public.test_sections set title = 'Mutated' where id = '45000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'Published Package Versions are immutable',
  'Published Test Sections cannot be mutated'
);
select throws_ok(
  $$update public.section_measurement_snapshots set cci_value = 7 where id = '46000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'Section measurement snapshots are immutable',
  'Measurement snapshots cannot be rewritten'
);
select throws_ok(
  $$insert into public.cci_categories (profile_id, category_order, label, value) values ('43000000-0000-4000-8000-000000000001', 2, 'Current 6', 6)$$,
  'P0001',
  'Active CCI Profiles are immutable; create a new profile version instead',
  'Active CCI Profile categories cannot be changed in place'
);

insert into public.section_measurement_snapshots (id, test_section_id, package_version_id, target_cvr_ohm, cci_profile_id, cci_category_id, cci_category_label, cci_value, supersedes_snapshot_id, override_reason, created_by_user_id)
values (
  '46000000-0000-4000-8000-000000000002',
  '45000000-0000-4000-8000-000000000001',
  '42000000-0000-4000-8000-000000000001',
  12,
  '43000000-0000-4000-8000-000000000001',
  '44000000-0000-4000-8000-000000000001',
  'Current 5 override',
  6,
  '46000000-0000-4000-8000-000000000001',
  'Approved measurement review',
  '31000000-0000-4000-8000-000000000001'
);
select is((select supersedes_snapshot_id from public.section_measurement_snapshots where id = '46000000-0000-4000-8000-000000000002'), '46000000-0000-4000-8000-000000000001'::uuid, 'Measurement override creates a new snapshot linked to the historical snapshot');
select is((select cci_value from public.section_measurement_snapshots where id = '46000000-0000-4000-8000-000000000001'), 5::numeric, 'Historical snapshot CCI is preserved after override');

insert into public.classes (id, course_id, name, teacher_user_id)
values ('51000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', 'Class A', '31000000-0000-4000-8000-000000000002');
insert into public.learning_sessions (id, class_id, status, planned_question_count, started_at, max_probe_count, session_format, prompt_language, test_package_version_id, test_section_id, section_measurement_snapshot_id)
values (
  '52000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000001',
  'open',
  12,
  now(),
  2,
  'test',
  'vi',
  '42000000-0000-4000-8000-000000000001',
  '45000000-0000-4000-8000-000000000001',
  '46000000-0000-4000-8000-000000000001'
);
insert into public.session_questions (id, learning_session_id, sequence_number, external_ref)
values ('53000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001', 1, 'live-test-item:47000000-0000-4000-8000-000000000001:v42000000-0000-4000-8000-000000000001');
select is((select external_ref from public.session_questions where id = '53000000-0000-4000-8000-000000000001'), 'live-test-item:47000000-0000-4000-8000-000000000001:v42000000-0000-4000-8000-000000000001', 'Session Questions preserve immutable versioned external_ref identity');
select is((select test_package_version_id from public.learning_sessions where id = '52000000-0000-4000-8000-000000000001'), '42000000-0000-4000-8000-000000000001'::uuid, 'Learning Session stores immutable Package Version reference');
select is((select section_measurement_snapshot_id from public.learning_sessions where id = '52000000-0000-4000-8000-000000000001'), '46000000-0000-4000-8000-000000000001'::uuid, 'Learning Session stores immutable measurement snapshot reference');

select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000002', true);
select is((select count(*)::int from public.test_package_versions), 1, 'Teacher can read published Package Versions');
select is((select count(*)::int from public.generation_jobs), 0, 'Teacher cannot read generation job audit records');

SELECT * FROM finish();
ROLLBACK;
