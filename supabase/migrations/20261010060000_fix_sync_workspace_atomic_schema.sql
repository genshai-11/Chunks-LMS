-- Migration: Match exact database column schema in sync_workspace_atomic
-- Canonical PRD: docs/plans/PRD-V1-TEACHER-SCOPED-SYNC.md
-- Canonical Ontology: docs/architecture/ONTOLOGY.md
-- Courses: (id, organization_id, code, name, status)
-- Classes: (id, course_id, name, capacity, teacher_user_id, status, starts_on, ends_on, schedule)
-- Scheduled: (id, class_id, planned_start, duration_minutes, status, rescheduled_from_id)
-- Learning: (id, class_id, scheduled_session_id, started_at, completed_at, status, session_kind, session_format, prompt_language)
-- Attendance: (id, learning_session_id, learner_user_id, status, recorded_at)

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
  v_teacher_id uuid;
  v_class_id uuid;
  v_session_id uuid;
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
        coalesce(nullif(trim(coalesce(v_item->>'displayName', v_item->>'display_name', '')), ''), 'Learner'),
        nullif(lower(btrim(coalesce(v_item->>'email', ''))), ''),
        coalesce(v_item->>'avatarUrl', v_item->>'avatar_url'),
        coalesce(v_item->>'accountStatus', v_item->>'account_status', 'active')::text,
        coalesce((v_item->>'allowMultiClass')::boolean, (v_item->>'allow_multi_class')::boolean, false)
      )
      on conflict (id) do update set
        display_name = coalesce(excluded.display_name, users.display_name),
        email = coalesce(excluded.email, users.email),
        avatar_url = coalesce(excluded.avatar_url, users.avatar_url),
        account_status = coalesce(excluded.account_status, users.account_status),
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

  -- 2) Process Courses (id, organization_id, code, name, status)
  if v_roster ? 'courses' and jsonb_array_length(v_roster->'courses') > 0 then
    for v_item in select * from jsonb_array_elements(v_roster->'courses') loop
      insert into public.courses (
        id, organization_id, code, name, status
      ) values (
        (v_item->>'id')::uuid,
        p_organization_id,
        coalesce(v_item->>'code', 'CRS'),
        coalesce(v_item->>'name', 'Course'),
        coalesce(v_item->>'status', 'active')::public.course_status
      )
      on conflict (id) do update set
        name = excluded.name,
        status = excluded.status;
    end loop;
  end if;

  -- 3) Process Classes (id, course_id, name, capacity, teacher_user_id, status, starts_on, ends_on, schedule)
  if v_roster ? 'classes' and jsonb_array_length(v_roster->'classes') > 0 then
    for v_item in select * from jsonb_array_elements(v_roster->'classes') loop
      v_teacher_id := coalesce(nullif(v_item->>'teacherUserId', ''), nullif(v_item->>'teacher_user_id', ''))::uuid;
      -- Non-admin teachers can only upsert their own classes
      if not v_is_admin and v_teacher_id <> v_actor then
        continue;
      end if;

      v_class_id := coalesce(nullif(v_item->>'id', ''), gen_random_uuid()::text)::uuid;
      insert into public.classes (
        id, course_id, name, capacity, teacher_user_id, status, starts_on, ends_on, schedule
      ) values (
        v_class_id,
        (coalesce(v_item->>'courseId', v_item->>'course_id'))::uuid,
        coalesce(v_item->>'name', 'Class'),
        coalesce((v_item->>'capacity')::integer, 3),
        v_teacher_id,
        coalesce(v_item->>'status', 'active')::public.class_status,
        (coalesce(v_item->>'startsOn', v_item->>'starts_on'))::date,
        (coalesce(v_item->>'endsOn', v_item->>'ends_on'))::date,
        coalesce(v_item->'schedule', null)
      )
      on conflict (id) do update set
        name = excluded.name,
        capacity = excluded.capacity,
        teacher_user_id = excluded.teacher_user_id,
        status = excluded.status,
        starts_on = coalesce(excluded.starts_on, classes.starts_on),
        ends_on = coalesce(excluded.ends_on, classes.ends_on),
        schedule = coalesce(excluded.schedule, classes.schedule);
    end loop;
  end if;

  -- 4) Process Enrollments
  if v_roster ? 'enrollments' and jsonb_array_length(v_roster->'enrollments') > 0 then
    for v_item in select * from jsonb_array_elements(v_roster->'enrollments') loop
      v_class_id := (coalesce(v_item->>'classId', v_item->>'class_id'))::uuid;

      -- Verify teacher owns class if not admin
      if not v_is_admin and not exists (
        select 1 from public.classes cl
        where cl.id = v_class_id and cl.teacher_user_id = v_actor
      ) then
        continue;
      end if;

      insert into public.enrollments (
        id, class_id, learner_user_id, status
      ) values (
        coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid()),
        v_class_id,
        (coalesce(v_item->>'learnerUserId', v_item->>'learner_user_id'))::uuid,
        coalesce(v_item->>'status', 'active')::public.enrollment_status
      )
      on conflict (class_id, learner_user_id) do update set
        status = excluded.status;
    end loop;
  end if;

  -- 5) Process Scheduled Sessions (planned_start, duration_minutes, status)
  if v_scheduling ? 'scheduledSessions' and jsonb_array_length(v_scheduling->'scheduledSessions') > 0 then
    for v_item in select * from jsonb_array_elements(v_scheduling->'scheduledSessions') loop
      v_class_id := (coalesce(v_item->>'classId', v_item->>'class_id'))::uuid;

      if not v_is_admin and not exists (
        select 1 from public.classes cl
        where cl.id = v_class_id and cl.teacher_user_id = v_actor
      ) then
        continue;
      end if;

      insert into public.scheduled_sessions (
        id, class_id, planned_start, duration_minutes, status, rescheduled_from_id
      ) values (
        (v_item->>'id')::uuid,
        v_class_id,
        coalesce((v_item->>'plannedStart')::timestamptz, (v_item->>'planned_start')::timestamptz, now()),
        coalesce((v_item->>'durationMinutes')::integer, (v_item->>'duration_minutes')::integer, 60),
        coalesce(v_item->>'status', 'scheduled')::public.schedule_status,
        nullif(coalesce(v_item->>'rescheduledFromId', v_item->>'rescheduled_from_id', ''), '')::uuid
      )
      on conflict (id) do update set
        planned_start = excluded.planned_start,
        duration_minutes = excluded.duration_minutes,
        status = excluded.status;
    end loop;
  end if;

  -- 6) Process Learning Sessions (started_at, completed_at, status, session_kind, session_format, prompt_language)
  if v_scheduling ? 'learningSessions' and jsonb_array_length(v_scheduling->'learningSessions') > 0 then
    for v_item in select * from jsonb_array_elements(v_scheduling->'learningSessions') loop
      v_class_id := (coalesce(v_item->>'classId', v_item->>'class_id'))::uuid;

      if not v_is_admin and not exists (
        select 1 from public.classes cl
        where cl.id = v_class_id and cl.teacher_user_id = v_actor
      ) then
        continue;
      end if;

      insert into public.learning_sessions (
        id, class_id, scheduled_session_id, started_at, completed_at, status, session_kind, session_format, prompt_language
      ) values (
        (v_item->>'id')::uuid,
        v_class_id,
        nullif(coalesce(v_item->>'scheduledSessionId', v_item->>'scheduled_session_id', ''), '')::uuid,
        coalesce((v_item->>'startedAt')::timestamptz, (v_item->>'started_at')::timestamptz, now()),
        coalesce((v_item->>'completedAt')::timestamptz, (v_item->>'completed_at')::timestamptz, (v_item->>'endedAt')::timestamptz, (v_item->>'ended_at')::timestamptz),
        coalesce(v_item->>'status', 'open')::public.learning_session_status,
        coalesce(v_item->>'sessionKind', v_item->>'session_kind', 'regular')::text,
        coalesce(v_item->>'sessionFormat', v_item->>'session_format', 'lesson')::text,
        coalesce(v_item->>'promptLanguage', v_item->>'prompt_language')
      )
      on conflict (id) do update set
        completed_at = excluded.completed_at,
        status = excluded.status,
        session_kind = excluded.session_kind,
        session_format = excluded.session_format,
        prompt_language = excluded.prompt_language;
    end loop;
  end if;

  -- 7) Process Attendance Records
  if v_scheduling ? 'attendance' and jsonb_array_length(v_scheduling->'attendance') > 0 then
    for v_item in select * from jsonb_array_elements(v_scheduling->'attendance') loop
      v_session_id := (coalesce(v_item->>'learningSessionId', v_item->>'learning_session_id'))::uuid;

      if not v_is_admin and not exists (
        select 1 from public.learning_sessions ls
        join public.classes cl on cl.id = ls.class_id
        where ls.id = v_session_id and cl.teacher_user_id = v_actor
      ) then
        continue;
      end if;

      insert into public.attendance_records (
        id, learning_session_id, learner_user_id, status, recorded_at
      ) values (
        coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid()),
        v_session_id,
        (coalesce(v_item->>'learnerUserId', v_item->>'learner_user_id'))::uuid,
        coalesce(v_item->>'status', 'present')::public.attendance_status,
        coalesce((v_item->>'recordedAt')::timestamptz, (v_item->>'recorded_at')::timestamptz, now())
      )
      on conflict (learning_session_id, learner_user_id) do update set
        status = excluded.status,
        recorded_at = excluded.recorded_at;
    end loop;
  end if;

  -- 8) Advance Revision & Record OCC update
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
