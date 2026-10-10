-- Migration: Attach roles and username to get_workspace_snapshot users
-- Canonical PRD: docs/plans/PRD-V1-TEACHER-SCOPED-SYNC.md
-- Canonical Ontology: docs/architecture/ONTOLOGY.md
-- Fixes missing teacher roles in get_workspace_snapshot by aggregating staff_roles and organization_memberships

create or replace function public.get_workspace_snapshot(p_organization_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid;
  v_is_admin boolean;
  v_org_id uuid := p_organization_id;
  v_revision bigint := 1;
  v_org record;
  v_courses jsonb := '[]'::jsonb;
  v_classes jsonb := '[]'::jsonb;
  v_enrollments jsonb := '[]'::jsonb;
  v_users jsonb := '[]'::jsonb;
  v_scheduled jsonb := '[]'::jsonb;
  v_learning jsonb := '[]'::jsonb;
  v_attendance jsonb := '[]'::jsonb;
begin
  v_actor := public.current_staff_user_id();
  v_is_admin := coalesce(public.current_staff_is_admin(), false);

  if v_actor is null then
    raise exception 'Staff authentication required' using errcode = '42501';
  end if;

  -- Default to the primary organization if none provided
  if v_org_id is null then
    select id into v_org_id from public.organizations order by created_at limit 1;
  end if;

  if v_org_id is null then
    return jsonb_build_object(
      'ok', true,
      'data', jsonb_build_object(
        'roster', jsonb_build_object('organization', jsonb_build_object('id', 'default', 'name', 'Default Org'), 'courses', '[]'::jsonb, 'classes', '[]'::jsonb, 'enrollments', '[]'::jsonb, 'users', '[]'::jsonb),
        'scheduling', jsonb_build_object('scheduledSessions', '[]'::jsonb, 'learningSessions', '[]'::jsonb, 'attendanceRecords', '[]'::jsonb)
      ),
      'revision', 1
    );
  end if;

  -- Fetch Organization details
  select id, name into v_org from public.organizations where id = v_org_id;

  -- Read or initialize revision
  select revision into v_revision from public.organization_workspace_versions where organization_id = v_org_id;
  if v_revision is null then
    v_revision := 1;
    insert into public.organization_workspace_versions (organization_id, revision, updated_at, updated_by)
    values (v_org_id, 1, now(), v_actor)
    on conflict (organization_id) do nothing;
  end if;

  -- Fetch Classes and Courses based on Role Scope
  if v_is_admin then
    select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into v_courses
    from public.courses c
    where c.organization_id = v_org_id;

    select coalesce(jsonb_agg(to_jsonb(cl)), '[]'::jsonb) into v_classes
    from public.classes cl
    join public.courses c on c.id = cl.course_id
    where c.organization_id = v_org_id;

    select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) into v_enrollments
    from public.enrollments e
    join public.classes cl on cl.id = e.class_id
    join public.courses c on c.id = cl.course_id
    where c.organization_id = v_org_id;

    -- Admin sees all users associated with this organization with populated roles
    select coalesce(
      jsonb_agg(
        to_jsonb(u) || jsonb_build_object(
          'roles', coalesce((
            select jsonb_agg(distinct r.role)
            from (
              select sr.role::text as role from public.staff_roles sr where sr.user_id = u.id and sr.active = true
              union
              select om.role::text as role from public.organization_memberships om where om.user_id = u.id and om.organization_id = v_org_id
            ) r
          ), '["learner"]'::jsonb)
        )
      ),
      '[]'::jsonb
    ) into v_users
    from public.users u
    where exists (
      select 1 from public.organization_memberships m
      where m.user_id = u.id and m.organization_id = v_org_id
    ) or exists (
      select 1 from public.staff_roles s where s.user_id = u.id and s.active = true
    );

    select coalesce(jsonb_agg(to_jsonb(ss)), '[]'::jsonb) into v_scheduled
    from public.scheduled_sessions ss
    join public.classes cl on cl.id = ss.class_id
    join public.courses c on c.id = cl.course_id
    where c.organization_id = v_org_id;

    select coalesce(jsonb_agg(to_jsonb(ls)), '[]'::jsonb) into v_learning
    from public.learning_sessions ls
    join public.classes cl on cl.id = ls.class_id
    join public.courses c on c.id = cl.course_id
    where c.organization_id = v_org_id;

    select coalesce(jsonb_agg(to_jsonb(att)), '[]'::jsonb) into v_attendance
    from public.attendance_records att
    join public.learning_sessions ls on ls.id = att.learning_session_id
    join public.classes cl on cl.id = ls.class_id
    join public.courses c on c.id = cl.course_id
    where c.organization_id = v_org_id;

  else
    -- TEACHER SCOPE: Only classes where teacher_user_id = v_actor
    select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into v_courses
    from public.courses c
    where c.organization_id = v_org_id
      and exists (
        select 1 from public.classes cl
        where cl.course_id = c.id and cl.teacher_user_id = v_actor
      );

    select coalesce(jsonb_agg(to_jsonb(cl)), '[]'::jsonb) into v_classes
    from public.classes cl
    join public.courses c on c.id = cl.course_id
    where c.organization_id = v_org_id and cl.teacher_user_id = v_actor;

    select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) into v_enrollments
    from public.enrollments e
    join public.classes cl on cl.id = e.class_id
    join public.courses c on c.id = cl.course_id
    where c.organization_id = v_org_id and cl.teacher_user_id = v_actor;

    -- Teacher sees their own user profile + learners enrolled in their classes with populated roles
    select coalesce(
      jsonb_agg(
        to_jsonb(u) || jsonb_build_object(
          'roles', coalesce((
            select jsonb_agg(distinct r.role)
            from (
              select sr.role::text as role from public.staff_roles sr where sr.user_id = u.id and sr.active = true
              union
              select om.role::text as role from public.organization_memberships om where om.user_id = u.id and om.organization_id = v_org_id
            ) r
          ), '["learner"]'::jsonb)
        )
      ),
      '[]'::jsonb
    ) into v_users
    from public.users u
    where u.id = v_actor or exists (
      select 1 from public.enrollments e
      join public.classes cl on cl.id = e.class_id
      where cl.teacher_user_id = v_actor and e.learner_user_id = u.id
    );

    select coalesce(jsonb_agg(to_jsonb(ss)), '[]'::jsonb) into v_scheduled
    from public.scheduled_sessions ss
    join public.classes cl on cl.id = ss.class_id
    where cl.teacher_user_id = v_actor;

    select coalesce(jsonb_agg(to_jsonb(ls)), '[]'::jsonb) into v_learning
    from public.learning_sessions ls
    join public.classes cl on cl.id = ls.class_id
    where cl.teacher_user_id = v_actor;

    select coalesce(jsonb_agg(to_jsonb(att)), '[]'::jsonb) into v_attendance
    from public.attendance_records att
    join public.learning_sessions ls on ls.id = att.learning_session_id
    join public.classes cl on cl.id = ls.class_id
    where cl.teacher_user_id = v_actor;
  end if;

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'roster', jsonb_build_object(
        'organization', jsonb_build_object('id', v_org.id, 'name', v_org.name),
        'courses', v_courses,
        'classes', v_classes,
        'enrollments', v_enrollments,
        'users', v_users
      ),
      'scheduling', jsonb_build_object(
        'scheduledSessions', v_scheduled,
        'learningSessions', v_learning,
        'attendanceRecords', v_attendance
      )
    ),
    'revision', v_revision
  );
end;
$$;

revoke all on function public.get_workspace_snapshot(uuid) from public, anon;
grant execute on function public.get_workspace_snapshot(uuid) to authenticated;
