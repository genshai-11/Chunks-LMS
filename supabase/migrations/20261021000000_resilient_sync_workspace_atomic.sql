-- Migration: Resilient Atomic Sync with Safe Type Casting and Enum Normalization
-- Date: 2026-10-21
-- Fixes:
-- 1. Adds public.try_cast_uuid and public.try_cast_int helpers to eliminate 400 Bad Request on invalid/empty inputs
-- 2. Normalizes learning_session_status so 'cancelled' or custom statuses do not trigger 22P02 enum exceptions
-- 3. Safely casts all JSON fields to prevent data exception aborts in sync_workspace_atomic

-- Safe UUID casting helper
create or replace function public.try_cast_uuid(p_val text)
returns uuid
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
begin
  if p_val is null or length(trim(p_val)) = 0 then
    return null;
  end if;
  return trim(p_val)::uuid;
exception when others then
  return null;
end;
$$;

-- Safe Integer casting helper
create or replace function public.try_cast_int(p_val text, p_default integer default null)
returns integer
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
begin
  if p_val is null or length(trim(p_val)) = 0 then
    return p_default;
  end if;
  return trim(p_val)::numeric::integer;
exception when others then
  return p_default;
end;
$$;

-- Enhanced sync_workspace_atomic
create or replace function public.sync_workspace_atomic(
  p_organization_id uuid,
  p_expected_revision bigint default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_actor uuid;
  v_is_admin boolean;
  v_current_revision bigint;
  v_next_revision bigint;
  v_roster jsonb;
  v_scheduling jsonb;
  v_item jsonb;
  v_class_id uuid;
  v_course_id uuid;
  v_session_id uuid;
  v_teacher_id uuid;
  v_learner_id uuid;
  v_user_id uuid;
  v_participants uuid[];
  v_participant_ids jsonb;
begin
  v_actor := public.current_staff_user_id();
  v_is_admin := coalesce(public.current_staff_is_admin(), false);

  if v_actor is null then
    return jsonb_build_object('ok', false, 'error', 'Staff authentication required');
  end if;

  if p_organization_id is null then
    return jsonb_build_object('ok', false, 'error', 'Organization ID required');
  end if;

  select revision into v_current_revision
  from public.organization_workspace_versions
  where organization_id = p_organization_id
  for update;

  if not found then
    v_current_revision := 1;
    insert into public.organization_workspace_versions (organization_id, revision, updated_by)
    values (p_organization_id, v_current_revision, v_actor)
    on conflict (organization_id) do nothing;
  end if;

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

  -- 1) Process Users
  if v_roster ? 'users' and jsonb_array_length(v_roster->'users') > 0 then
    for v_item in select * from jsonb_array_elements(v_roster->'users') loop
      v_user_id := public.try_cast_uuid(v_item->>'id');
      if v_user_id is null then
        continue;
      end if;

      -- Non-admin cannot modify staff profiles or alter account_status of staff members
      if not v_is_admin and v_user_id <> v_actor and exists (
        select 1 from public.staff_roles sr
        where sr.user_id = v_user_id and sr.active = true
      ) then
        continue;
      end if;

      insert into public.users (
        id, display_name, email, avatar_url, account_status, allow_multi_class
      ) values (
        v_user_id,
        coalesce(nullif(trim(coalesce(v_item->>'displayName', v_item->>'display_name', '')), ''), 'Learner'),
        nullif(lower(btrim(coalesce(v_item->>'email', ''))), ''),
        coalesce(v_item->>'avatarUrl', v_item->>'avatar_url'),
        case
          when v_is_admin then coalesce(v_item->>'accountStatus', v_item->>'account_status', 'active')::text
          when not exists (select 1 from public.staff_roles sr where sr.user_id = v_user_id and sr.active = true)
            then coalesce(v_item->>'accountStatus', v_item->>'account_status', 'active')::text
          else 'active'
        end,
        coalesce((v_item->>'allowMultiClass')::boolean, (v_item->>'allow_multi_class')::boolean, false)
      )
      on conflict (id) do update set
        display_name = coalesce(excluded.display_name, users.display_name),
        email = coalesce(excluded.email, users.email),
        avatar_url = coalesce(excluded.avatar_url, users.avatar_url),
        account_status = case
          when v_is_admin then coalesce(excluded.account_status, users.account_status)
          when not exists (select 1 from public.staff_roles sr where sr.user_id = users.id and sr.active = true)
            then coalesce(excluded.account_status, users.account_status)
          else users.account_status
        end,
        allow_multi_class = coalesce(excluded.allow_multi_class, users.allow_multi_class),
        updated_at = now();

      -- Only admins can manage organization memberships
      if v_is_admin and v_item ? 'roles' and jsonb_array_length(v_item->'roles') > 0 then
        insert into public.organization_memberships (organization_id, user_id, role)
        select distinct
          p_organization_id,
          v_user_id,
          val::public.app_role
        from jsonb_array_elements_text(v_item->'roles') as val
        where val in ('admin', 'teacher', 'learner')
        on conflict (organization_id, user_id, role) do nothing;
      end if;
    end loop;
  end if;

  -- 2) Process Courses
  if v_roster ? 'courses' and jsonb_array_length(v_roster->'courses') > 0 then
    for v_item in select * from jsonb_array_elements(v_roster->'courses') loop
      v_course_id := public.try_cast_uuid(v_item->>'id');
      if v_course_id is null then
        continue;
      end if;

      insert into public.courses (
        id, organization_id, code, name, status
      ) values (
        v_course_id,
        p_organization_id,
        coalesce(nullif(trim(v_item->>'code'), ''), 'COURSE'),
        coalesce(nullif(trim(v_item->>'name'), ''), 'Course'),
        case when (v_item->>'status') = 'archived' then 'archived'::public.course_status else 'active'::public.course_status end
      )
      on conflict (id) do update set
        code = excluded.code,
        name = excluded.name,
        status = excluded.status;
    end loop;
  end if;

  -- 3) Process Classes (Anti-hijacking: non-admin cannot take over another teacher's class)
  if v_roster ? 'classes' and jsonb_array_length(v_roster->'classes') > 0 then
    for v_item in select * from jsonb_array_elements(v_roster->'classes') loop
      v_class_id := public.try_cast_uuid(v_item->>'id');
      v_course_id := public.try_cast_uuid(coalesce(v_item->>'courseId', v_item->>'course_id'));
      v_teacher_id := public.try_cast_uuid(coalesce(v_item->>'teacherUserId', v_item->>'teacher_user_id'));

      if v_class_id is null or v_course_id is null or v_teacher_id is null then
        continue;
      end if;

      if not v_is_admin then
        -- Check if target class already belongs to another teacher
        if exists (
          select 1 from public.classes cl
          where cl.id = v_class_id and cl.teacher_user_id <> v_actor
        ) then
          continue;
        end if;
        if v_teacher_id <> v_actor then
          continue;
        end if;
      end if;

      insert into public.classes (
        id, course_id, name, capacity, teacher_user_id, status, starts_on, ends_on, schedule
      ) values (
        v_class_id,
        v_course_id,
        coalesce(nullif(trim(v_item->>'name'), ''), 'Class'),
        public.try_cast_int(v_item->>'capacity', 3),
        v_teacher_id,
        case when (v_item->>'status') = 'ended' then 'ended'::public.class_status else 'active'::public.class_status end,
        case when (coalesce(v_item->>'startsOn', v_item->>'starts_on')) ~ '^\d{4}-\d{2}-\d{2}' then (coalesce(v_item->>'startsOn', v_item->>'starts_on'))::date else null end,
        case when (coalesce(v_item->>'endsOn', v_item->>'ends_on')) ~ '^\d{4}-\d{2}-\d{2}' then (coalesce(v_item->>'endsOn', v_item->>'ends_on'))::date else null end,
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
      v_class_id := public.try_cast_uuid(coalesce(v_item->>'classId', v_item->>'class_id'));
      v_learner_id := public.try_cast_uuid(coalesce(v_item->>'learnerUserId', v_item->>'learner_user_id'));

      if v_class_id is null or v_learner_id is null then
        continue;
      end if;

      if not v_is_admin and not exists (
        select 1 from public.classes cl
        where cl.id = v_class_id and cl.teacher_user_id = v_actor
      ) then
        continue;
      end if;

      insert into public.enrollments (
        id, class_id, learner_user_id, status
      ) values (
        coalesce(public.try_cast_uuid(v_item->>'id'), gen_random_uuid()),
        v_class_id,
        v_learner_id,
        case when (v_item->>'status') = 'ended' then 'ended'::public.enrollment_status else 'active'::public.enrollment_status end
      )
      on conflict (class_id, learner_user_id) do update set
        status = excluded.status;
    end loop;
  end if;

  -- 5) Process Scheduled Sessions (Anti-hijacking: non-admin cannot alter other teacher's sessions)
  if v_scheduling ? 'scheduledSessions' and jsonb_array_length(v_scheduling->'scheduledSessions') > 0 then
    for v_item in select * from jsonb_array_elements(v_scheduling->'scheduledSessions') loop
      v_session_id := public.try_cast_uuid(v_item->>'id');
      v_class_id := public.try_cast_uuid(coalesce(v_item->>'classId', v_item->>'class_id'));

      if v_session_id is null or v_class_id is null then
        continue;
      end if;

      if not v_is_admin then
        if not exists (
          select 1 from public.classes cl
          where cl.id = v_class_id and cl.teacher_user_id = v_actor
        ) then
          continue;
        end if;
        if exists (
          select 1 from public.scheduled_sessions ss
          join public.classes cl on cl.id = ss.class_id
          where ss.id = v_session_id and cl.teacher_user_id <> v_actor
        ) then
          continue;
        end if;
      end if;

      insert into public.scheduled_sessions (
        id, class_id, planned_start, duration_minutes, status, rescheduled_from_id
      ) values (
        v_session_id,
        v_class_id,
        coalesce((v_item->>'plannedStart')::timestamptz, (v_item->>'planned_start')::timestamptz, now()),
        public.try_cast_int(coalesce(v_item->>'durationMinutes', v_item->>'duration_minutes'), 60),
        case when (v_item->>'status') in ('scheduled', 'completed', 'cancelled', 'rescheduled') then (v_item->>'status')::public.schedule_status else 'scheduled'::public.schedule_status end,
        public.try_cast_uuid(coalesce(v_item->>'rescheduledFromId', v_item->>'rescheduled_from_id'))
      )
      on conflict (id) do update set
        planned_start = excluded.planned_start,
        duration_minutes = excluded.duration_minutes,
        status = excluded.status;
    end loop;
  end if;

  -- 6) Process Learning Sessions (Anti-hijacking: non-admin cannot alter other teacher's sessions)
  if v_scheduling ? 'learningSessions' and jsonb_array_length(v_scheduling->'learningSessions') > 0 then
    for v_item in select * from jsonb_array_elements(v_scheduling->'learningSessions') loop
      v_session_id := public.try_cast_uuid(v_item->>'id');
      v_class_id := public.try_cast_uuid(coalesce(v_item->>'classId', v_item->>'class_id'));

      if v_session_id is null or v_class_id is null then
        continue;
      end if;

      if not v_is_admin then
        if not exists (
          select 1 from public.classes cl
          where cl.id = v_class_id and cl.teacher_user_id = v_actor
        ) then
          continue;
        end if;
        if exists (
          select 1 from public.learning_sessions ls
          join public.classes cl on cl.id = ls.class_id
          where ls.id = v_session_id and cl.teacher_user_id <> v_actor
        ) then
          continue;
        end if;
      end if;

      -- Safely parse participant_learner_ids array
      v_participants := null;
      v_participant_ids := coalesce(v_item->'participantLearnerIds', v_item->'participant_learner_ids');
      if v_participant_ids is not null and jsonb_typeof(v_participant_ids) = 'array' then
        select coalesce(array_agg(p_id), array[]::uuid[])
        into v_participants
        from (
          select public.try_cast_uuid(elem) as p_id
          from jsonb_array_elements_text(v_participant_ids) as elem
        ) sub where p_id is not null;
      end if;

      insert into public.learning_sessions (
        id,
        class_id,
        scheduled_session_id,
        started_at,
        completed_at,
        status,
        session_kind,
        session_format,
        prompt_language,
        session_number,
        owner_user_id,
        lock_expires_at,
        planned_question_count,
        max_probe_count,
        live_test_resource_id,
        live_test_block_id,
        participant_learner_ids
      ) values (
        v_session_id,
        v_class_id,
        public.try_cast_uuid(coalesce(v_item->>'scheduledSessionId', v_item->>'scheduled_session_id')),
        coalesce((v_item->>'startedAt')::timestamptz, (v_item->>'started_at')::timestamptz, now()),
        coalesce((v_item->>'completedAt')::timestamptz, (v_item->>'completed_at')::timestamptz, (v_item->>'endedAt')::timestamptz, (v_item->>'ended_at')::timestamptz),
        case when (v_item->>'status') = 'completed' then 'completed'::public.learning_session_status else 'open'::public.learning_session_status end,
        coalesce(v_item->>'sessionKind', v_item->>'session_kind', 'regular')::text,
        coalesce(v_item->>'sessionFormat', v_item->>'session_format', 'lesson')::text,
        coalesce(v_item->>'promptLanguage', v_item->>'prompt_language'),
        public.try_cast_int(coalesce(v_item->>'sessionNumber', v_item->>'session_number')),
        public.try_cast_uuid(coalesce(v_item->>'ownerUserId', v_item->>'owner_user_id')),
        case when (coalesce(v_item->>'lockExpiresAt', v_item->>'lock_expires_at')) is not null then (coalesce(v_item->>'lockExpiresAt', v_item->>'lock_expires_at'))::timestamptz else null end,
        public.try_cast_int(coalesce(v_item->>'plannedQuestionCount', v_item->>'planned_question_count')),
        public.try_cast_int(coalesce(v_item->>'maxProbeCount', v_item->>'max_probe_count'), 2),
        public.try_cast_uuid(coalesce(v_item->>'liveTestResourceId', v_item->>'live_test_resource_id')),
        public.try_cast_uuid(coalesce(v_item->>'liveTestBlockId', v_item->>'live_test_block_id')),
        v_participants
      )
      on conflict (id) do update set
        completed_at = excluded.completed_at,
        status = excluded.status,
        session_kind = excluded.session_kind,
        session_format = excluded.session_format,
        prompt_language = excluded.prompt_language,
        session_number = coalesce(excluded.session_number, learning_sessions.session_number),
        owner_user_id = coalesce(excluded.owner_user_id, learning_sessions.owner_user_id),
        lock_expires_at = excluded.lock_expires_at,
        planned_question_count = coalesce(excluded.planned_question_count, learning_sessions.planned_question_count),
        max_probe_count = coalesce(excluded.max_probe_count, learning_sessions.max_probe_count),
        live_test_resource_id = coalesce(excluded.live_test_resource_id, learning_sessions.live_test_resource_id),
        live_test_block_id = coalesce(excluded.live_test_block_id, learning_sessions.live_test_block_id),
        participant_learner_ids = coalesce(excluded.participant_learner_ids, learning_sessions.participant_learner_ids);
    end loop;
  end if;

  -- 7) Process Attendance Records
  if v_scheduling ? 'attendance' and jsonb_array_length(v_scheduling->'attendance') > 0 then
    for v_item in select * from jsonb_array_elements(v_scheduling->'attendance') loop
      v_session_id := public.try_cast_uuid(coalesce(v_item->>'learningSessionId', v_item->>'learning_session_id'));
      v_learner_id := public.try_cast_uuid(coalesce(v_item->>'learnerUserId', v_item->>'learner_user_id'));

      if v_session_id is null or v_learner_id is null then
        continue;
      end if;

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
        coalesce(public.try_cast_uuid(v_item->>'id'), gen_random_uuid()),
        v_session_id,
        v_learner_id,
        case when (v_item->>'status') in ('present', 'late', 'absent', 'excused') then (v_item->>'status')::public.attendance_status else 'present'::public.attendance_status end,
        coalesce((v_item->>'recordedAt')::timestamptz, (v_item->>'recorded_at')::timestamptz, now())
      )
      on conflict (learning_session_id, learner_user_id) do update set
        status = excluded.status,
        recorded_at = excluded.recorded_at;
    end loop;
  end if;

  -- Advance revision counter
  v_next_revision := v_current_revision + 1;
  update public.organization_workspace_versions
  set
    revision = v_next_revision,
    updated_at = now(),
    updated_by = v_actor
  where organization_id = p_organization_id;

  return jsonb_build_object(
    'ok', true,
    'revision', v_next_revision
  );
end;
$$;
