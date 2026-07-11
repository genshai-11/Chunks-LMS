-- Deterministic local seed: 1 org, 1 course, 1 teacher, 1 class, 3 learners

insert into public.organizations (id, name, clerk_org_id)
values (
  '11111111-1111-1111-1111-111111111111',
  'Chunks Demo Org',
  'org_demo_chunks'
);

insert into public.users (id, clerk_user_id, display_name, email) values
  ('22222222-2222-2222-2222-222222222201', 'user_admin_demo', 'Demo Admin', 'admin@example.com'),
  ('22222222-2222-2222-2222-222222222202', 'user_teacher_demo', 'Demo Teacher', 'teacher@example.com'),
  ('22222222-2222-2222-2222-222222222203', 'user_learner_1', 'Learner One', 'l1@example.com'),
  ('22222222-2222-2222-2222-222222222204', 'user_learner_2', 'Learner Two', 'l2@example.com'),
  ('22222222-2222-2222-2222-222222222205', 'user_learner_3', 'Learner Three', 'l3@example.com');

insert into public.organization_memberships (organization_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', 'admin'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222202', 'teacher'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222203', 'learner'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222204', 'learner'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222205', 'learner');

insert into public.courses (id, organization_id, code, name, status, starts_on, ends_on)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'ERE-Level-B',
  'ERE Level B',
  'active',
  '2026-07-01',
  '2026-12-31'
);

insert into public.classes (id, course_id, name, capacity, teacher_user_id, status)
values (
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  'Class B-1',
  3,
  '22222222-2222-2222-2222-222222222202',
  'active'
);

insert into public.enrollments (class_id, learner_user_id, status) values
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222203', 'active'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222204', 'active'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222205', 'active');
