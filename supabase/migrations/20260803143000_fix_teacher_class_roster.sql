-- Restore Teacher-owned course/class visibility and provide one narrow,
-- atomic learner creation path. Teachers do not receive broad workspace write
-- access; ownership remains database-enforced through the assigned Class.

-- The previous policy accidentally compared classes.course_id to classes.id,
-- which can never identify the outer Course and caused assigned Classes to be
-- discarded by the client after their Course rows were hidden.
drop policy if exists courses_staff_select on public.courses;
create policy courses_staff_select on public.courses
  for select to authenticated
  using (
    (select public.current_staff_is_admin())
    or exists (
      select 1
      from public.classes cl
      where cl.course_id = courses.id
        and (select public.current_teacher_owns_class(cl.id))
    )
  );

create or replace function public.create_teacher_learner_and_enroll(
  p_class_id uuid,
  p_display_name text,
  p_email text default null,
  p_avatar_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid;
  v_is_admin boolean;
  v_class_teacher uuid;
  v_class_status public.class_status;
  v_class_capacity integer;
  v_active_enrollment_count integer;
  v_organization_id uuid;
  v_display_name text := btrim(coalesce(p_display_name, ''));
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_learner public.users%rowtype;
  v_enrollment public.enrollments%rowtype;
  v_email_matches integer;
begin
  v_actor := public.current_staff_user_id();
  v_is_admin := coalesce(public.current_staff_is_admin(), false);

  if v_actor is null then
    raise exception 'Active staff account required' using errcode = '42501';
  end if;

  select cl.teacher_user_id, cl.status, cl.capacity, course.organization_id
    into v_class_teacher, v_class_status, v_class_capacity, v_organization_id
  from public.classes cl
  join public.courses course on course.id = cl.course_id
  where cl.id = p_class_id
  for update of cl;

  if v_class_teacher is null then
    raise exception 'Class not found' using errcode = '22023';
  end if;
  if v_class_status <> 'active' then
    raise exception 'Active class required' using errcode = '22023';
  end if;
  if not v_is_admin and v_class_teacher <> v_actor then
    raise exception 'Teacher does not own this class' using errcode = '42501';
  end if;

  if v_display_name = '' or char_length(v_display_name) > 200 then
    raise exception 'Learner name must be 1-200 characters' using errcode = '22023';
  end if;
  if v_email is not null
     and v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Valid learner email required' using errcode = '22023';
  end if;
  if p_avatar_url is not null and char_length(p_avatar_url) > 100000 then
    raise exception 'Learner avatar is too large' using errcode = '22023';
  end if;

  if v_email is not null then
    -- Serialize same-email creation across different Classes without storing a
    -- separate lock row or broadening direct table write permissions.
    perform pg_advisory_xact_lock(hashtextextended(v_email, 0));

    select count(*) into v_email_matches
    from public.users candidate
    where lower(btrim(candidate.email)) = v_email;

    if v_email_matches > 1 then
      raise exception 'Multiple accounts already use this email' using errcode = '23505';
    end if;

    select candidate.* into v_learner
    from public.users candidate
    where lower(btrim(candidate.email)) = v_email
    limit 1
    for update;
  end if;

  if v_learner.id is null then
    insert into public.users (
      display_name,
      email,
      avatar_url,
      account_status,
      allow_multi_class,
      auth_user_id,
      clerk_user_id,
      legacy_clerk_user_id
    )
    values (
      v_display_name,
      v_email,
      p_avatar_url,
      'active',
      false,
      null,
      null,
      null
    )
    returning * into v_learner;
  else
    if v_learner.account_status <> 'active' then
      raise exception 'Learner account is inactive' using errcode = '22023';
    end if;
    if exists (
      select 1
      from public.staff_roles staff_role
      where staff_role.user_id = v_learner.id
        and staff_role.active
    ) then
      raise exception 'Email belongs to a staff account' using errcode = '23505';
    end if;
  end if;

  if not v_learner.allow_multi_class and exists (
    select 1
    from public.enrollments other_enrollment
    where other_enrollment.learner_user_id = v_learner.id
      and other_enrollment.class_id <> p_class_id
      and other_enrollment.status = 'active'
  ) then
    raise exception 'Learner is already enrolled in another active class' using errcode = '23514';
  end if;

  select enrollment.* into v_enrollment
  from public.enrollments enrollment
  where enrollment.class_id = p_class_id
    and enrollment.learner_user_id = v_learner.id
  for update;

  if v_enrollment.id is not null and v_enrollment.status = 'active' then
    raise exception 'Learner is already enrolled' using errcode = '23505';
  end if;

  -- The Class row lock above serializes this explicit count for all calls to
  -- this RPC. The existing enrollment trigger remains a second defense for
  -- direct writes through any other authorized path.
  select count(*) into v_active_enrollment_count
  from public.enrollments active_enrollment
  where active_enrollment.class_id = p_class_id
    and active_enrollment.status = 'active';

  if v_active_enrollment_count >= v_class_capacity then
    raise exception 'Class is full (capacity %)', v_class_capacity using errcode = '23514';
  end if;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (v_organization_id, v_learner.id, 'learner')
  on conflict (organization_id, user_id, role) do nothing;

  if v_enrollment.id is not null then
    update public.enrollments
    set status = 'active',
        started_at = now(),
        ended_at = null
    where id = v_enrollment.id
    returning * into v_enrollment;
  else
    insert into public.enrollments (class_id, learner_user_id, status)
    values (p_class_id, v_learner.id, 'active')
    returning * into v_enrollment;
  end if;

  return jsonb_build_object(
    'learnerId', v_learner.id,
    'enrollmentId', v_enrollment.id,
    'classId', p_class_id,
    'displayName', v_learner.display_name,
    'email', v_learner.email
  );
end;
$$;

revoke all on function public.create_teacher_learner_and_enroll(uuid, text, text, text)
  from public, anon;
grant execute on function public.create_teacher_learner_and_enroll(uuid, text, text, text)
  to authenticated;

comment on function public.create_teacher_learner_and_enroll(uuid, text, text, text) is
  'Atomically creates/reuses a profile-only Learner and enrolls them in an active Class owned by the current Teacher (or any Class for Admin).';
