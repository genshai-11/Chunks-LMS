BEGIN;
SELECT plan(17);

-- Fixed test identities.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.com', crypt('password', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{"chunksRole":"teacher"}'::jsonb),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teacher-a@example.com', crypt('password', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teacher-b@example.com', crypt('password', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'metadata-admin@example.com', crypt('password', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{"chunksRole":"admin"}'::jsonb);

insert into public.organizations (id, name) values
  ('20000000-0000-4000-8000-000000000001', 'Chunks Workspace');
insert into public.users (id, auth_user_id, legacy_clerk_user_id, display_name, email) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'user_admin_legacy', 'Admin', 'admin@example.com'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', null, 'Teacher A', 'teacher-a@example.com'),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', null, 'Teacher B', 'teacher-b@example.com'),
  ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', null, 'Metadata Admin', 'metadata-admin@example.com'),
  ('30000000-0000-4000-8000-000000000011', null, null, 'Learner One', 'learner1@example.com'),
  ('30000000-0000-4000-8000-000000000012', null, null, 'Learner Two', 'learner2@example.com');
insert into public.staff_roles (user_id, role, active) values
  ('30000000-0000-4000-8000-000000000001', 'admin', true),
  ('30000000-0000-4000-8000-000000000002', 'teacher', true),
  ('30000000-0000-4000-8000-000000000003', 'teacher', true);
insert into public.organization_memberships (organization_id, user_id, role) values
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'admin'),
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'teacher'),
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 'teacher'),
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000011', 'learner'),
  ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000012', 'learner');
insert into public.courses (id, organization_id, code, name) values
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'A', 'Course A');
insert into public.classes (id, course_id, name, teacher_user_id) values
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Class A', '30000000-0000-4000-8000-000000000002'),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'Class B', '30000000-0000-4000-8000-000000000003');
insert into public.enrollments (id, class_id, learner_user_id) values
  ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000011'),
  ('60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000012');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select public.current_staff_is_admin()), true, 'Admin role comes from staff_roles, not user metadata');
select is((select count(*)::int from public.users), 5, 'Admin can read all workspace users');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is((select public.current_staff_is_admin()), false, 'Teacher is not admin despite any metadata absence');
select is((select count(*)::int from public.classes), 1, 'Teacher sees only owned class');
select is((select count(*)::int from public.enrollments), 1, 'Teacher sees only owned class enrollments');
select is((select count(*)::int from public.users where id = '30000000-0000-4000-8000-000000000012'), 0, 'Teacher cannot read learner outside owned classes');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select is((select public.current_staff_user_id() is null), true, 'User-editable Auth metadata cannot grant staff access without staff_roles');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select isnt_empty($$select url_token from public.issue_learner_access_token('30000000-0000-4000-8000-000000000011', '50000000-0000-4000-8000-000000000001', 3600)$$, 'Admin can issue learner access token');
select is((select count(*)::int from public.learner_access_tokens where token_hash like 'lat_%'), 0, 'Raw learner token is not stored');

-- Capture the issued token for learner verification tests.
create temp table issued_token as
select url_token, token_id from public.issue_learner_access_token('30000000-0000-4000-8000-000000000011', '50000000-0000-4000-8000-000000000001', 3600);
insert into public.learner_access_tokens (token_hash, learner_user_id, class_id, issued_by_user_id, issued_at, expires_at)
values (
  public.learner_access_token_hash('lat_expired'),
  '30000000-0000-4000-8000-000000000011',
  '50000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  now() - interval '2 hours',
  now() - interval '1 hour'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is((select count(*)::int from public.users), 0, 'Anon cannot directly read protected user rows');
select is((select count(*)::int from public.verify_learner_access((select url_token from issued_token))), 1, 'Anon can verify valid signed learner token through RPC');
select is((select count(*)::int from public.verify_learner_access('lat_invalid')), 0, 'Invalid learner token returns no protected rows');
select is((select count(*)::int from public.verify_learner_access('lat_expired')), 0, 'Expired learner token returns no protected rows');
select is(
  jsonb_path_exists(
    public.learner_access_snapshot((select url_token from issued_token)),
    '$.** ? (@ == "30000000-0000-4000-8000-000000000012")'
  ),
  false,
  'Learner snapshot excludes every out-of-scope learner reference'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select public.revoke_learner_access_token((select token_id from issued_token));
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is((select count(*)::int from public.verify_learner_access((select url_token from issued_token))), 0, 'Revoked learner token returns no protected rows');

SELECT * FROM finish();
ROLLBACK;
