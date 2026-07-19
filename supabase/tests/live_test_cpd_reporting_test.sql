BEGIN;
SELECT plan(8);

-- Create Fixtures
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('14000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rep-admin@example.com', crypt('password', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
       ('14000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rep-learner@example.com', crypt('password', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.organizations (id, name) values ('24000000-0000-4000-8000-000000000001', 'Rep Workspace');

insert into public.users (id, auth_user_id, display_name, email) values
  ('34000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', 'Rep Admin', 'rep-admin@example.com'),
  ('34000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000002', 'Rep Learner', 'rep-learner@example.com');

insert into public.staff_roles (user_id, role, active) values
  ('34000000-0000-4000-8000-000000000001', 'admin', true);

insert into public.organization_memberships (organization_id, user_id, role) values
  ('24000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', 'admin'),
  ('24000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000002', 'learner');

insert into public.courses (id, organization_id, code, name) values
  ('35000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', 'REP', 'Rep Reporting Course');

insert into public.classes (id, course_id, name, teacher_user_id) values
  ('36000000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000001', 'Rep Class', '34000000-0000-4000-8000-000000000001');

insert into public.enrollments (class_id, learner_user_id) values
  ('36000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000002');

-- Setup packages
insert into public.test_packages (id, organization_id, title, slug) values
  ('44000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', 'Rep Package', 'rep-pkg');

insert into public.test_package_versions (id, package_id, version_label, status) values
  ('45000000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000001', '1.0.0-draft', 'draft'),
  ('45000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000001', '1.0.0-pub', 'published');

insert into public.cci_profiles (id, organization_id, name, version_label, status) values
  ('46000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', 'Rep Profile', '1.0.0', 'active');

insert into public.cci_categories (id, profile_id, category_order, label, value) values
  ('47000000-0000-4000-8000-000000000001', '46000000-0000-4000-8000-000000000001', 1, 'Rep Cat 1', 4);

insert into public.test_sections (id, package_version_id, section_order, title) values
  ('48000000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-000000000002', 1, 'Section 1');

-- Create immutable snapshot setting target_cvr_ohm = 5, cciValue = 4
insert into public.section_measurement_snapshots (id, test_section_id, package_version_id, target_cvr_ohm, cci_profile_id, cci_category_id, cci_category_label, cci_value) values
  ('49000000-0000-4000-8000-000000000001', '48000000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-000000000002', 5, '46000000-0000-4000-8000-000000000001', '47000000-0000-4000-8000-000000000001', 'Rep Cat 1', 4);

-- Live learning sessions linking version, section, and snapshot
insert into public.learning_sessions (id, class_id, status, planned_question_count, started_at, max_probe_count, session_format, prompt_language, test_package_version_id, test_section_id, section_measurement_snapshot_id) values
  ('51000000-0000-4000-8000-000000000001', '36000000-0000-4000-8000-000000000001', 'closed', 2, now(), 2, 'test', 'vi', '45000000-0000-4000-8000-000000000002', '48000000-0000-4000-8000-000000000001', '49000000-0000-4000-8000-000000000001');

insert into public.session_questions (id, learning_session_id, sequence_number, external_ref) values
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 1, 'live-test-item:test-item-1:v45000000-0000-4000-8000-000000000002'),
  ('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000001', 2, 'live-test-item:test-item-2:v45000000-0000-4000-8000-000000000002');

-- Assessment attempts
insert into public.assessment_attempts (id, learning_session_id, session_question_id, learner_user_id, teacher_user_id) values
  ('53000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000002', '34000000-0000-4000-8000-000000000001'),
  ('53000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000002', '34000000-0000-4000-8000-000000000002', '34000000-0000-4000-8000-000000000001');

-- Attempt 1: status finalized, color green (score 2)
insert into public.assessment_attempt_snapshots (attempt_id, status, provisional_color, effective_color, effective_score, probe_count, max_probe_count, entered_probe_flow, updated_at) values
  ('53000000-0000-4000-8000-000000000001', 'finalized', 'green', 'green', 2, 0, 2, false, now());

-- Attempt 2: status corrected, color purple (score 3)
insert into public.assessment_attempt_snapshots (attempt_id, status, provisional_color, effective_color, effective_score, probe_count, max_probe_count, entered_probe_flow, updated_at) values
  ('53000000-0000-4000-8000-000000000002', 'corrected', 'green', 'purple', 3, 0, 2, false, now());

-- Switch to Admin role
set local role authenticated;
select set_config('request.jwt.claim.sub', '14000000-0000-4000-8000-000000000001', true);

-- Test raw cpd records
select is((select count(*)::int from public.get_learner_cpd_records('34000000-0000-4000-8000-000000000002')), 2, 'Get 2 CPD records for learner');
select is((select target_cvr_ohm from public.get_learner_cpd_records('34000000-0000-4000-8000-000000000002') order by finalized_at desc limit 1), 5, 'Record target CVR is derived correctly');
select is((select cci_value from public.get_learner_cpd_records('34000000-0000-4000-8000-000000000002') order by finalized_at desc limit 1), 4, 'Record CCI is derived correctly');
select is((select item_cpd from public.get_learner_cpd_records('34000000-0000-4000-8000-000000000002') order by finalized_at desc limit 1), 20, 'item_cpd = CVR * CCI is correct');

-- Test report json structure
declare
  v_report jsonb;
begin
  select public.calculate_learner_cpd_report('34000000-0000-4000-8000-000000000002') into v_report;
  
  perform is(v_report->>'learnerUserId', '34000000-0000-4000-8000-000000000002', 'Report carries correct learner ID');
  perform is((v_report->>'totalAttempts')::int, 2, 'Report sums finalized/corrected attempts correctly');
  perform is((v_report->>'averageItemCpd')::numeric, 20.00, 'Average item CPD is correct');
  perform is((v_report->>'averageLearnerCpdScore')::numeric, 50.00, 'Average learner CPD score is correct (average of 40 and 60)');
end;

SELECT * FROM finish();
ROLLBACK;
