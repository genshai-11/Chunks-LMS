begin;
select plan(12);

select has_function(
  'public',
  'create_teacher_learner_and_enroll',
  array['uuid', 'text', 'text', 'text'],
  'Teacher learner/enrollment RPC exists'
);

select ok(
  (
    select prosecdef
    from pg_proc
    where oid = 'public.create_teacher_learner_and_enroll(uuid, text, text, text)'::regprocedure
  ),
  'Teacher learner/enrollment RPC is SECURITY DEFINER'
);

select ok(
  (
    select proconfig::text like '%pg_catalog, public%'
    from pg_proc
    where oid = 'public.create_teacher_learner_and_enroll(uuid, text, text, text)'::regprocedure
  ),
  'Teacher learner/enrollment RPC fixes search_path'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.create_teacher_learner_and_enroll(uuid, text, text, text)',
    'EXECUTE'
  ),
  'anonymous users cannot create Learners'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_teacher_learner_and_enroll(uuid, text, text, text)',
    'EXECUTE'
  ),
  'authenticated staff can invoke the ownership-checked RPC'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'courses'
      and policyname = 'courses_staff_select'
      and qual like '%cl.course_id = courses.id%'
  ),
  'assigned Course policy correlates the inner Class to the outer Course'
);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'courses'
      and policyname = 'courses_staff_select'
      and qual like '%cl.course_id = cl.id%'
  ),
  'assigned Course policy no longer compares Course ID with Class ID'
);

select ok(
  position(
    'v_class_teacher <> v_actor' in
    pg_get_functiondef('public.create_teacher_learner_and_enroll(uuid, text, text, text)'::regprocedure)
  ) > 0,
  'RPC enforces assigned Teacher ownership'
);

select ok(
  position(
    'allow_multi_class' in
    pg_get_functiondef('public.create_teacher_learner_and_enroll(uuid, text, text, text)'::regprocedure)
  ) > 0,
  'RPC preserves the multi-class enrollment rule'
);

select ok(
  position(
    'organization_memberships' in
    pg_get_functiondef('public.create_teacher_learner_and_enroll(uuid, text, text, text)'::regprocedure)
  ) > 0,
  'RPC creates the Learner organization membership atomically'
);

select ok(
  position(
    'for update of cl' in
    lower(pg_get_functiondef('public.create_teacher_learner_and_enroll(uuid, text, text, text)'::regprocedure))
  ) > 0,
  'RPC serializes class capacity decisions'
);

select ok(
  position(
    'v_active_enrollment_count >= v_class_capacity' in
    pg_get_functiondef('public.create_teacher_learner_and_enroll(uuid, text, text, text)'::regprocedure)
  ) > 0,
  'RPC checks capacity explicitly before enrollment'
);

select * from finish();
rollback;
