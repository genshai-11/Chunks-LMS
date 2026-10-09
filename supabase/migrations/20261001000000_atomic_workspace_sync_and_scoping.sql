-- Migration: Atomic Workspace Sync, Scoped Snapshots, and OCC Revision Tracking
-- Canonical PRD: docs/plans/PRD-V1-TEACHER-SCOPED-SYNC.md
-- Canonical Ontology: docs/architecture/ONTOLOGY.md

-- 1. Optimistic Concurrency Control (OCC) Revision Tracking
create table if not exists public.organization_workspace_versions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id),
  checksum text
);

alter table public.organization_workspace_versions enable row level security;

create policy organization_workspace_versions_read on public.organization_workspace_versions
  for select to authenticated
  using (true);

create policy organization_workspace_versions_admin on public.organization_workspace_versions
  for all to authenticated
  using ((select public.current_staff_is_admin()))
  with check ((select public.current_staff_is_admin()));

-- 2. Scoped Workspace Snapshot RPC
-- Returns structured JSON containing only data visible to the caller:
--   - Admin: All courses, classes, enrollments, learners, and sessions for the organization.
--   - Teacher: Only courses and classes owned by the caller, learners enrolled in their classes, and sessions of those classes.
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

    -- Admin sees all users associated with this organization
    select coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb) into v_users
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

    -- Teacher sees their own user profile + learners enrolled in their classes
    select coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb) into v_users
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

-- 3. Atomic Workspace Sync RPC
-- Replaces the 10-step HTTP REST waterfall with a single atomic transaction.
-- Performs OCC revision check: rejects with CONFLICT if revision changed on server.
create or replace function public.sync_workspace_atomic(
  p_organization_id uuid,
  p_expected_revision bigint default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid;
  v_is_admin boolean;
  v_current_revision bigint;
  v_next_revision bigint;
  v_item jsonb;
  v_roster jsonb;
  v_scheduling jsonb;
begin
  v_actor := public.current_staff_user_id();
  v_is_admin := coalesce(public.current_staff_is_admin(), false);

  if v_actor is null then
    raise exception 'Staff authentication required' using errcode = '42501';
  end if;

  -- Lock and check OCC revision
  select revision into v_current_revision
  from public.organization_workspace_versions
  where organization_id = p_organization_id
  for update;

  if v_current_revision is null then
    v_current_revision := 1;
    insert into public.organization_workspace_versions (organization_id, revision, updated_at, updated_by)
    values (p_organization_id, 1, now(), v_actor)
    on conflict (organization_id) do nothing;
  end if;

  -- If client provided an expected revision, enforce OCC
  if p_expected_revision is not null and p_expected_revision < v_current_revision then
    return jsonb_build_object(
      'ok', false,
      'code', 'CONFLICT_REVISION_MISMATCH',
      'error', 'Workspace has been updated by another user or tab. Please reload.',
      'serverRevision', v_current_revision
    );
  end if;

  v_roster := p_payload->'roster';
  v_scheduling := p_payload->'scheduling';

  -- 1) Process Users (Upsert profile details)
  if v_roster ? 'users' and jsonb_array_length(v_roster->'users') > 0 then
    for v_item in select * from jsonb_array_elements(v_roster->'users') loop
      insert into public.users (
        id, display_name, email, avatar_url, account_status, allow_multi_class
      ) values (
        (v_item->>'id')::uuid,
        v_item->>'displayName',
        nullif(lower(btrim(v_item->>'email')), ''),
        v_item->>'avatarUrl',
        coalesce(v_item->>'accountStatus', 'active')::public.account_status,
        coalesce((v_item->>'allowMultiClass')::boolean, false)
      )
      on conflict (id) do update set
        display_name = excluded.display_name,
        email = coalesce(excluded.email, users.email),
        avatar_url = coalesce(excluded.avatar_url, users.avatar_url),
        account_status = excluded.account_status,
        updated_at = now();

      -- Maintain organization membership
      if v_item ? 'roles' then
        insert into public.organization_memberships (organization_id, user_id, role)
        select p_organization_id, (v_item->>'id')::uuid, r::public.app_role
        from jsonb_array_elements_text(v_item->'roles') as r
        where r in ('admin', 'teacher', 'learner')
        on conflict (organization_id, user_id, role) do nothing;
      end if;
    end loop;
  end if;

  -- 2) Process Courses (Admin or Teacher owner)
  if v_roster ? 'courses' and jsonb_array_length(v_roster->'courses') > 0 then
    for v_item in select * from jsonb_array_elements(v_roster->'courses') loop
      insert into public.courses (
        id, organization_id, code, name, status, starts_on, ends_on
      ) values (
        (v_item->>'id')::uuid,
        p_organization_id,
        coalesce(v_item->>'code', 'CRS'),
        v_item->>'name',
        coalesce(v_item->>'status', 'active')::public.course_status,
        (v_item->>'startsOn')::date,
        (v_item->>'endsOn')::date
      )
      on conflict (id) do update set
        name = excluded.name,
        status = excluded.status,
        starts_on = excluded.starts_on,
        ends_on = excluded.ends_on;
    end loop;
  end if;

  -- 3) Process Classes (Teacher ownership check)
  if v_roster ? 'classes' and jsonb_array_length(v_roster->'classes') > 0 then
    for v_item in select * from jsonb_array_elements(v_roster->'classes') loop
      -- Non-admin teachers can only upsert their own classes
      if not v_is_admin and (v_item->>'teacherUserId')::uuid <> v_actor then
        continue;
      end if;

      insert into public.classes (
        id, course_id, name, capacity, teacher_user_id, status
      ) values (
        (v_item->>'id')::uuid,
        (v_item->>'courseId')::uuid,
        v_item->>'name',
        coalesce((v_item->>'capacity')::integer, 3),
        (v_item->>'teacherUserId')::uuid,
        coalesce(v_item->>'status', 'active')::public.class_status
      )
      on conflict (id) do update set
        name = excluded.name,
        capacity = excluded.capacity,
        teacher_user_id = excluded.teacher_user_id,
        status = excluded.status;
    end loop;
  end if;

  -- 4) Process Enrollments
  if v_roster ? 'enrollments' and jsonb_array_length(v_roster->'enrollments') > 0 then
    for v_item in select * from jsonb_array_elements(v_roster->'enrollments') loop
      -- Verify teacher owns class if not admin
      if not v_is_admin and not exists (
        select 1 from public.classes cl
        where cl.id = (v_item->>'classId')::uuid and cl.teacher_user_id = v_actor
      ) then
        continue;
      end if;

      insert into public.enrollments (
        id, class_id, learner_user_id, status
      ) values (
        coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid()),
        (v_item->>'classId')::uuid,
        (v_item->>'learnerUserId')::uuid,
        coalesce(v_item->>'status', 'active')::public.enrollment_status
      )
      on conflict (class_id, learner_user_id) do update set
        status = excluded.status;
    end loop;
  end if;

  -- 5) Process Scheduled Sessions
  if v_scheduling ? 'scheduledSessions' and jsonb_array_length(v_scheduling->'scheduledSessions') > 0 then
    for v_item in select * from jsonb_array_elements(v_scheduling->'scheduledSessions') loop
      if not v_is_admin and not exists (
        select 1 from public.classes cl
        where cl.id = (v_item->>'classId')::uuid and cl.teacher_user_id = v_actor
      ) then
        continue;
      end if;

      insert into public.scheduled_sessions (
        id, class_id, starts_at, ends_at, status
      ) values (
        (v_item->>'id')::uuid,
        (v_item->>'classId')::uuid,
        (v_item->>'startsAt')::timestamptz,
        (v_item->>'endsAt')::timestamptz,
        coalesce(v_item->>'status', 'scheduled')::public.schedule_status
      )
      on conflict (id) do update set
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        status = excluded.status;
    end loop;
  end if;

  -- 6) Process Learning Sessions
  if v_scheduling ? 'learningSessions' and jsonb_array_length(v_scheduling->'learningSessions') > 0 then
    for v_item in select * from jsonb_array_elements(v_scheduling->'learningSessions') loop
      if not v_is_admin and not exists (
        select 1 from public.classes cl
        where cl.id = (v_item->>'classId')::uuid and cl.teacher_user_id = v_actor
      ) then
        continue;
      end if;

      insert into public.learning_sessions (
        id, class_id, scheduled_session_id, started_at, ended_at, status, session_kind, session_format, prompt_language
      ) values (
        (v_item->>'id')::uuid,
        (v_item->>'classId')::uuid,
        nullif(v_item->>'scheduledSessionId', '')::uuid,
        coalesce((v_item->>'startedAt')::timestamptz, now()),
        (v_item->>'endedAt')::timestamptz,
        coalesce(v_item->>'status', 'open')::public.learning_session_status,
        coalesce(v_item->>'sessionKind', 'regular')::text,
        coalesce(v_item->>'sessionFormat', 'lesson')::text,
        v_item->>'promptLanguage'
      )
      on conflict (id) do update set
        ended_at = excluded.ended_at,
        status = excluded.status,
        session_kind = excluded.session_kind,
        session_format = excluded.session_format,
        prompt_language = excluded.prompt_language;
    end loop;
  end if;

  -- 7) Advance Revision & Record OCC update
  v_next_revision := v_current_revision + 1;
  update public.organization_workspace_versions
  set revision = v_next_revision,
      updated_at = now(),
      updated_by = v_actor
  where organization_id = p_organization_id;

  return jsonb_build_object(
    'ok', true,
    'revision', v_next_revision
  );
end;
$$;

revoke all on function public.sync_workspace_atomic(uuid, bigint, jsonb) from public, anon;
grant execute on function public.sync_workspace_atomic(uuid, bigint, jsonb) to authenticated;
