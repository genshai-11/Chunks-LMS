BEGIN;
SELECT plan(16);

-- Setup explicit local/CI mock mode and a sentinel secret that must not leak.
select set_config('app.ninerouter_api_key', 'super-secret-token-12345', true);

-- Create Fixtures
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('13000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gen-admin@example.com', crypt('password', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
       ('13000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gen-teacher@example.com', crypt('password', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.organizations (id, name) values ('23000000-0000-4000-8000-000000000001', 'Gen Workspace');

insert into public.users (id, auth_user_id, display_name, email) values
  ('33000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001', 'Gen Admin', 'gen-admin@example.com'),
  ('33000000-0000-4000-8000-000000000002', '13000000-0000-4000-8000-000000000002', 'Gen Teacher', 'gen-teacher@example.com');

insert into public.staff_roles (user_id, role, active) values
  ('33000000-0000-4000-8000-000000000001', 'admin', true),
  ('33000000-0000-4000-8000-000000000002', 'teacher', true);

insert into public.organization_memberships (organization_id, user_id, role) values
  ('23000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001', 'admin'),
  ('23000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000002', 'teacher');

insert into public.test_packages (id, organization_id, title, slug) values
  ('44000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001', 'Gen Package', 'gen-package');

insert into public.test_package_versions (id, package_id, version_label, status) values
  ('45000000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000001', '1.0.0-draft', 'draft'),
  ('45000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000001', '1.0.0-pub', 'published');

insert into public.test_sections (id, package_version_id, section_order, title) values
  ('46000000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-000000000001', 1, 'Draft Section 1'),
  ('46000000-0000-4000-8000-000000000002', '45000000-0000-4000-8000-000000000002', 1, 'Pub Section 1');

insert into public.test_items (id, section_id, package_version_id, item_order, prompt_vi, prompt_en) values
  ('47000000-0000-4000-8000-000000000001', '46000000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-000000000001', 1, 'Câu hỏi gốc', 'Original question');

-- Switch to Admin role
set local role authenticated;
select set_config('request.jwt.claim.sub', '13000000-0000-4000-8000-000000000001', true);

-- 1. Database generation RPCs are explicit local/CI mocks only. The real
-- production path is the live-test-generation Edge Function.
select throws(
  $$ select public.generate_test_item('45000000-0000-4000-8000-000000000001', '46000000-0000-4000-8000-000000000001', 'Mẫu mới') $$,
  'Generation requires the live-test-generation Edge Function; database deterministic mocks require app.live_test_generation_mode=mock.',
  'Database RPC does not silently mock without explicit local/CI mode'
);

select set_config('app.live_test_generation_mode', 'mock', true);

select is(
  (select public.generate_test_item('45000000-0000-4000-8000-000000000001', '46000000-0000-4000-8000-000000000001', 'Mẫu mới')->>'status'),
  'succeeded',
  'Admin can trigger explicit local/CI test item mock generation successfully'
);

select is(
  (select count(*)::int from public.generation_jobs where job_type = 'test_item' and status = 'succeeded'),
  1,
  'Test item generation job row is saved as succeeded'
);

-- 2. Test generate_test_item draft guard
select throws(
  $$ select public.generate_test_item('45000000-0000-4000-8000-000000000002', '46000000-0000-4000-8000-000000000002', 'Mẫu mới') $$,
  'Conflict: Package version is not a draft and cannot be modified.',
  'Generating test item inside published package version fails'
);

-- 3. Test generate_narration section_intro success
declare
  v_res jsonb;
  v_job_id uuid;
begin
  select public.generate_narration(
    '45000000-0000-4000-8000-000000000001',
    'section_intro',
    '46000000-0000-4000-8000-000000000001',
    null,
    'vi',
    'voice-1'
  ) into v_res;
  v_job_id := (v_res->>'jobId')::uuid;

  perform is(v_res->>'status', 'succeeded', 'Admin can trigger narration generation for section_intro');
  perform is((select count(*)::int from public.generation_jobs where id = v_job_id), 1, 'TTS generation job is registered');
  perform is((select count(*)::int from public.audio_assets where visibility = 'private' and source_kind = 'generated_tts'), 1, 'Private audio asset is created');
  perform is((select approval_status from public.narration_variants where generation_job_id = v_job_id), 'generated', 'TTS narration variant is created in generated status (pending review)');
end;

-- 4. Test approve_generated_asset success
declare
  v_res jsonb;
  v_job_id uuid;
  v_approve_res jsonb;
begin
  select id into v_job_id from public.generation_jobs where job_type = 'section_intro_narration' limit 1;
  select public.approve_generated_asset(v_job_id, 'Approved for production') into v_approve_res;

  perform is(v_approve_res->>'approved', 'true', 'Admin can approve generated narration variant');
  perform is((select approval_status from public.narration_variants where generation_job_id = v_job_id), 'approved', 'Narration variant status changes to approved');
  perform is((select approved_by_user_id from public.narration_variants where generation_job_id = v_job_id), '33000000-0000-4000-8000-000000000001'::uuid, 'Approved by current Admin');
end;

-- 5. Test secrets isolation
select isnt(
  (select public.generate_test_item('45000000-0000-4000-8000-000000000001', '46000000-0000-4000-8000-000000000001', 'Test Secrets')::text),
  '%super-secret-token-12345%',
  'Secrets/API tokens are not leaked in the returned JSON receipt'
);

select is(
  (select provider_metadata::text from public.generation_jobs where status = 'succeeded' limit 1) not like '%super-secret-token-12345%',
  true,
  'Secrets/API tokens are not saved in public auditable provider_metadata column'
);

-- 6. Switch to Teacher role and test access controls
select set_config('request.jwt.claim.sub', '13000000-0000-4000-8000-000000000002', true);

select throws(
  $$ select public.generate_test_item('45000000-0000-4000-8000-000000000001', '46000000-0000-4000-8000-000000000001', 'Mẫu mới') $$,
  'Access Denied: Only Admin staff can request Test Item generation.',
  'Teacher cannot trigger test item generation'
);

select throws(
  $$ select public.generate_narration('45000000-0000-4000-8000-000000000001', 'section_intro', '46000000-0000-4000-8000-000000000001', null, 'vi', 'voice-1') $$,
  'Access Denied: Only Admin staff can request narration generation.',
  'Teacher cannot trigger narration generation'
);

select throws(
  $$ select public.approve_generated_asset('55000000-0000-4000-8000-000000000001'::uuid, 'Teacher approve') $$,
  'Access Denied: Only Admin staff can approve generated narration variants.',
  'Teacher cannot approve generated assets'
);

SELECT * FROM finish();
ROLLBACK;
