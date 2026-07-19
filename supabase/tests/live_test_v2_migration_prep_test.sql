BEGIN;
SELECT plan(15);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('12000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'migration-admin@example.com', crypt('password', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.organizations (id, name) values ('22000000-0000-4000-8000-000000000001', 'Chunks Workspace');
insert into public.users (id, auth_user_id, legacy_clerk_user_id, display_name, email) values
  ('32000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', 'clerk-admin', 'Migration Admin', 'migration-admin@example.com'),
  ('32000000-0000-4000-8000-000000000002', null, 'clerk-learner', 'Migration Learner', 'migration-learner@example.com');
insert into public.staff_roles (user_id, role, active) values ('32000000-0000-4000-8000-000000000001', 'admin', true);
insert into public.organization_memberships (organization_id, user_id, role) values
  ('22000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', 'admin'),
  ('22000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000002', 'learner');
insert into public.courses (id, organization_id, code, name) values ('33000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', 'MIG', 'Migration Course');
insert into public.classes (id, course_id, name, teacher_user_id) values ('34000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001', 'Migration Class', '32000000-0000-4000-8000-000000000001');
insert into public.enrollments (class_id, learner_user_id) values ('34000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000002');

insert into public.live_test_resources (id, organization_id, title, version, status, source_filename) values
  ('41000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', 'CCI CVR Live Test', '1.0.0', 'active', 'Chunks-resource - CVR_new.csv');
insert into public.live_test_blocks (id, resource_id, block_number, title) values
  ('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 1, 'Session 1');
insert into public.live_test_items (id, block_id, item_number, source_day, source_stt, unit_ohm, cci_value, term_vi, term_en, prompt_vi, prompt_en, tc, lc, tl, cvr_value) values
  ('43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 1, 'Day 2', 'S1', 3, 3, 'A', 'A en', 'Câu A', 'Sentence A', 3, 1, 1, 3),
  ('43000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000001', 2, 'Day 2', 'S2', 3, 3, 'B', 'B en', 'Câu B', 'Sentence B', 2, 2, 1, 4);

insert into public.learning_sessions (id, class_id, status, planned_question_count, started_at, max_probe_count, session_format, prompt_language, live_test_resource_id, live_test_block_id) values
  ('51000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', 'open', 2, now(), 2, 'test', 'vi', '41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001');
insert into public.session_questions (id, learning_session_id, sequence_number, external_ref) values
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 1, 'live-test-item:43000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-4000-8000-000000000001', true);

select is(public.live_test_v2_deterministic_uuid('same-basis'), public.live_test_v2_deterministic_uuid('same-basis'), 'Deterministic UUID helper is idempotent');
select like(public.live_test_v2_source_row_checksum((select i from public.live_test_items i where id = '43000000-0000-4000-8000-000000000001')), 'sha256:%', 'Source row checksum is present');

select is((public.preview_live_test_v2_migration('Chunks-resource - CVR_new.csv')->'counts'->>'legacyResources')::int, 1, 'Preview counts legacy resources');
select is((public.preview_live_test_v2_migration('Chunks-resource - CVR_new.csv')->'counts'->>'legacyBlocks')::int, 1, 'Preview counts legacy blocks');
select is((public.preview_live_test_v2_migration('Chunks-resource - CVR_new.csv')->'counts'->>'legacyItems')::int, 2, 'Preview counts legacy items');
select is((public.preview_live_test_v2_migration('Chunks-resource - CVR_new.csv')->'counts'->>'resolvedExternalRefs')::int, 1, 'Preview resolves legacy external refs');
select is((public.preview_live_test_v2_migration('Chunks-resource - CVR_new.csv')->'counts'->>'unresolvedExternalRefs')::int, 0, 'Preview reports no unresolved refs for complete fixture');
select is((public.preview_live_test_v2_migration('Chunks-resource - CVR_new.csv')->'compatibility'->>'staffWithLegacyClerkRefs')::int, 1, 'Preview reports staff legacy Clerk refs');
select is((public.preview_live_test_v2_migration('Chunks-resource - CVR_new.csv')->'compatibility'->>'staffWithSupabaseAuthLinks')::int, 1, 'Preview reports staff Supabase Auth links');
select is((public.preview_live_test_v2_migration('Chunks-resource - CVR_new.csv')->'compatibility'->>'learnersWithoutAuthAccounts')::int, 1, 'Preview reports learner profile without Auth account');
select is(public.preview_live_test_v2_migration('Chunks-resource - CVR_new.csv')->>'remoteMutation', 'false', 'Preview declares zero remote mutation');
select is(public.preview_live_test_v2_migration('Chunks-resource - CVR_new.csv')->'historyGuard'->>'checksumBefore', public.preview_live_test_v2_migration('Chunks-resource - CVR_new.csv')->'historyGuard'->>'checksumAfterDryRun', 'Dry-run history checksum is unchanged');
select is((public.preview_live_test_v2_migration('Chunks-resource - CVR_new.csv')->'anomalies')::jsonb, '[]'::jsonb, 'Fixture dry-run has no anomalies');
select is(public.apply_live_test_v2_catalog_backfill('ticket-7-local-dry-run', 'Chunks-resource - CVR_new.csv', true)->>'applied', 'false', 'Backfill helper defaults to dry-run/no apply mode');
select is((select count(*)::int from public.live_test_v2_migration_runs where run_label = 'ticket-7-local-dry-run' and dry_run), 1, 'Dry-run helper records an idempotency/audit report');

SELECT * FROM finish();
ROLLBACK;
