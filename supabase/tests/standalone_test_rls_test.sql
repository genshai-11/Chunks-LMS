begin;
select plan(6);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
('71000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','standalone-teacher@example.com',crypt('password',gen_salt('bf')),now(),now(),now(),'{}','{}'),
('71000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','other-teacher@example.com',crypt('password',gen_salt('bf')),now(),now(),now(),'{}','{}');
insert into public.organizations(id,name) values
('72000000-0000-4000-8000-000000000001','Standalone Org'),
('72000000-0000-4000-8000-000000000002','Other Org');
insert into public.users(id,auth_user_id,legacy_clerk_user_id,display_name,email,account_status) values
('73000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','standalone-teacher','Teacher','standalone-teacher@example.com','active'),
('73000000-0000-4000-8000-000000000002',null,'standalone-learner','Learner','learner@example.com','active'),
('73000000-0000-4000-8000-000000000003','71000000-0000-4000-8000-000000000002','other-teacher','Other Teacher','other-teacher@example.com','active'),
('73000000-0000-4000-8000-000000000004',null,'other-learner','Other Learner','other-learner@example.com','active');
insert into public.staff_roles(user_id,role,active) values
('73000000-0000-4000-8000-000000000001','teacher',true),
('73000000-0000-4000-8000-000000000003','teacher',true);
insert into public.organization_memberships(organization_id,user_id,role) values
('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','teacher'),
('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000002','learner'),
('72000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000003','teacher'),
('72000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000004','learner');

set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
select ok(private.staff_can_manage_standalone_test('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000002'), 'teacher can test active same-org learner without Class');
select is(private.staff_can_manage_standalone_test('72000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000004'), false, 'teacher cannot test cross-org learner');
select is(private.staff_can_manage_standalone_test('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000004'), false, 'learner must belong to requested organization');
select is((select count(*)::int from public.classes), 0, 'standalone authorization requires no Class fixture');
select is((select count(*)::int from public.enrollments), 0, 'standalone authorization requires no Enrollment fixture');
select ok((select indexdef like '%WHERE (status = ANY%' or indexdef like '%where status%' from pg_indexes where indexname='standalone_test_runs_one_open_section_idx'), 'partial index enforces one open run per assignment/section');

select * from finish();
rollback;
