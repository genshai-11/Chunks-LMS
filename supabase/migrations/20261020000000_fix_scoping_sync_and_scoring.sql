-- Migration: Fix Scoping, Atomic Sync Schema, and Scoring Security
-- Date: 2026-10-20
-- Covers:
-- 1. Defer class capacity trigger to commit time (enables atomic learner swaps) with O(1) class-scoped check
-- 2. Complete schema coverage & anti-hijacking guards in sync_workspace_atomic
-- 3. Scoping and authorization checks with unforgeable actor_user_id in live scoring RPCs

-- ============================================================================
-- 1. Defer Class Capacity Constraint Trigger (Class-scoped O(1) check)
-- ============================================================================

create or replace function public.enforce_class_capacity()
returns trigger language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_cap integer;
  v_count integer;
begin
  if NEW.status = 'active' then
    select capacity into v_cap from public.classes where id = NEW.class_id;
    select count(*) into v_count
    from public.enrollments
    where class_id = NEW.class_id and status = 'active';

    if v_count > v_cap then
      raise exception 'Class is full (capacity %)', v_cap;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_enforce_class_capacity on public.enrollments;

create constraint trigger trg_enforce_class_capacity
after insert or update on public.enrollments
deferrable initially deferred
for each row execute function public.enforce_class_capacity();

-- ============================================================================
-- 2. Enhanced sync_workspace_atomic with Anti-Hijacking Verification
-- ============================================================================

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
  v_session_id uuid;
  v_teacher_id uuid;
  v_participants uuid[];
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
      -- Non-admin cannot modify staff profiles or alter account_status of staff members
      if not v_is_admin and (v_item->>'id')::uuid <> v_actor and exists (
        select 1 from public.staff_roles sr
        where sr.user_id = (v_item->>'id')::uuid and sr.active = true
      ) then
        continue;
      end if;

      insert into public.users (
        id, display_name, email, avatar_url, account_status, allow_multi_class
      ) values (
        (v_item->>'id')::uuid,
        coalesce(nullif(trim(coalesce(v_item->>'displayName', v_item->>'display_name', '')), ''), 'Learner'),
        nullif(lower(btrim(coalesce(v_item->>'email', ''))), ''),
        coalesce(v_item->>'avatarUrl', v_item->>'avatar_url'),
        case when v_is_admin then coalesce(v_item->>'accountStatus', v_item->>'account_status', 'active')::text else 'active' end,
        coalesce((v_item->>'allowMultiClass')::boolean, (v_item->>'allow_multi_class')::boolean, false)
      )
      on conflict (id) do update set
        display_name = coalesce(excluded.display_name, users.display_name),
        email = coalesce(excluded.email, users.email),
        avatar_url = coalesce(excluded.avatar_url, users.avatar_url),
        account_status = case when v_is_admin then coalesce(excluded.account_status, users.account_status) else users.account_status end,
        allow_multi_class = coalesce(excluded.allow_multi_class, users.allow_multi_class),
        updated_at = now();

      -- Only admins can manage organization memberships
      if v_is_admin and v_item ? 'roles' and jsonb_array_length(v_item->'roles') > 0 then
        insert into public.organization_memberships (organization_id, user_id, role)
        select distinct
          p_organization_id,
          (v_item->>'id')::uuid,
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
      insert into public.courses (
        id, organization_id, code, name, status
      ) values (
        (v_item->>'id')::uuid,
        p_organization_id,
        coalesce(nullif(trim(v_item->>'code'), ''), 'COURSE'),
        coalesce(nullif(trim(v_item->>'name'), ''), 'Course'),
        coalesce(v_item->>'status', 'active')::public.course_status
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
      v_class_id := (v_item->>'id')::uuid;
      v_teacher_id := (coalesce(v_item->>'teacherUserId', v_item->>'teacher_user_id'))::uuid;

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

  -- 5) Process Scheduled Sessions (Anti-hijacking: non-admin cannot alter other teacher's sessions)
  if v_scheduling ? 'scheduledSessions' and jsonb_array_length(v_scheduling->'scheduledSessions') > 0 then
    for v_item in select * from jsonb_array_elements(v_scheduling->'scheduledSessions') loop
      v_class_id := (coalesce(v_item->>'classId', v_item->>'class_id'))::uuid;

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
          where ss.id = (v_item->>'id')::uuid and cl.teacher_user_id <> v_actor
        ) then
          continue;
        end if;
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

  -- 6) Process Learning Sessions (Anti-hijacking: non-admin cannot alter other teacher's sessions)
  if v_scheduling ? 'learningSessions' and jsonb_array_length(v_scheduling->'learningSessions') > 0 then
    for v_item in select * from jsonb_array_elements(v_scheduling->'learningSessions') loop
      v_class_id := (coalesce(v_item->>'classId', v_item->>'class_id'))::uuid;

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
          where ls.id = (v_item->>'id')::uuid and cl.teacher_user_id <> v_actor
        ) then
          continue;
        end if;
      end if;

      -- Parse participant_learner_ids array if present
      v_participants := null;
      if v_item ? 'participantLearnerIds' and jsonb_typeof(v_item->'participantLearnerIds') = 'array' then
        select coalesce(array_agg((elem)::text::uuid), array[]::uuid[])
        into v_participants
        from jsonb_array_elements_text(v_item->'participantLearnerIds') as elem
        where elem is not null and elem <> '';
      elsif v_item ? 'participant_learner_ids' and jsonb_typeof(v_item->'participant_learner_ids') = 'array' then
        select coalesce(array_agg((elem)::text::uuid), array[]::uuid[])
        into v_participants
        from jsonb_array_elements_text(v_item->'participant_learner_ids') as elem
        where elem is not null and elem <> '';
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
        (v_item->>'id')::uuid,
        v_class_id,
        nullif(coalesce(v_item->>'scheduledSessionId', v_item->>'scheduled_session_id', ''), '')::uuid,
        coalesce((v_item->>'startedAt')::timestamptz, (v_item->>'started_at')::timestamptz, now()),
        coalesce((v_item->>'completedAt')::timestamptz, (v_item->>'completed_at')::timestamptz, (v_item->>'endedAt')::timestamptz, (v_item->>'ended_at')::timestamptz),
        coalesce(v_item->>'status', 'open')::public.learning_session_status,
        coalesce(v_item->>'sessionKind', v_item->>'session_kind', 'regular')::text,
        coalesce(v_item->>'sessionFormat', v_item->>'session_format', 'lesson')::text,
        coalesce(v_item->>'promptLanguage', v_item->>'prompt_language'),
        (coalesce(v_item->>'sessionNumber', v_item->>'session_number'))::integer,
        nullif(coalesce(v_item->>'ownerUserId', v_item->>'owner_user_id', ''), '')::uuid,
        (coalesce(v_item->>'lockExpiresAt', v_item->>'lock_expires_at'))::timestamptz,
        (coalesce(v_item->>'plannedQuestionCount', v_item->>'planned_question_count'))::integer,
        coalesce((v_item->>'maxProbeCount')::integer, (v_item->>'max_probe_count')::integer, 2),
        nullif(coalesce(v_item->>'liveTestResourceId', v_item->>'live_test_resource_id', ''), '')::uuid,
        coalesce(v_item->>'liveTestBlockId', v_item->>'live_test_block_id'),
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

-- ============================================================================
-- 3. Live Scoring Authorization Scoping & Unforgeable Actor
-- ============================================================================

create or replace function public.record_provisional_result(
  p_attempt_id uuid,
  p_color public.result_color,
  p_actor_user_id uuid default null
)
returns public.assessment_attempt_snapshots
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  snap public.assessment_attempt_snapshots;
  sess public.learning_sessions;
  v_caller uuid;
  v_is_admin boolean;
begin
  v_caller := public.current_staff_user_id();
  v_is_admin := coalesce(public.current_staff_is_admin(), false);

  if v_caller is null then
    raise exception 'Staff authentication required' using errcode = '42501';
  end if;

  if p_color not in ('red', 'orange', 'green', 'purple') then
    raise exception 'Primary capture color must be Red, Orange, Green, or Purple';
  end if;

  select ls.* into sess
  from public.assessment_attempts aa
  join public.learning_sessions ls on ls.id = aa.learning_session_id
  join public.classes c on c.id = ls.class_id
  where aa.id = p_attempt_id
    and (v_is_admin or c.teacher_user_id = v_caller or ls.owner_user_id = v_caller)
  for update of ls;

  if sess is null then
    raise exception 'Not authorized to score this session' using errcode = '42501';
  end if;

  if sess.status = 'completed' then
    raise exception 'Cannot capture on completed Learning Session';
  end if;

  select * into snap
  from public.assessment_attempt_snapshots
  where attempt_id = p_attempt_id
  for update;

  if snap is null then
    if exists (select 1 from public.assessment_attempts where id = p_attempt_id) then
      insert into public.assessment_attempt_snapshots (attempt_id, status, max_probe_count)
      values (p_attempt_id, 'draft', coalesce(sess.max_probe_count, 2))
      on conflict (attempt_id) do nothing;

      select * into snap
      from public.assessment_attempt_snapshots
      where attempt_id = p_attempt_id
      for update;
    end if;
  end if;

  if snap is null then
    raise exception 'Snapshot missing for attempt %', p_attempt_id;
  end if;

  if snap.status <> 'draft' then
    raise exception 'Provisional result can only be recorded on draft attempt';
  end if;

  -- Always log the authentic caller to prevent audit trail spoofing
  insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
  values (p_attempt_id, 'provisional_recorded', jsonb_build_object('color', p_color), v_caller);

  if p_color = 'green' then
    update public.assessment_attempt_snapshots
    set status = 'probe_open',
        provisional_color = p_color,
        entered_probe_flow = true,
        updated_at = now()
    where attempt_id = p_attempt_id
    returning * into snap;
  else
    insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
    values (p_attempt_id, 'result_finalized', jsonb_build_object('color', p_color), v_caller);

    update public.assessment_attempt_snapshots
    set status = 'finalized',
        effective_color = p_color,
        effective_score = public.color_factor(p_color),
        finalized_at = now(),
        updated_at = now()
    where attempt_id = p_attempt_id
    returning * into snap;
  end if;

  return snap;
end;
$$;

create or replace function public.resolve_probe(
  p_attempt_id uuid,
  p_outcome text,
  p_actor_user_id uuid default null
)
returns public.assessment_attempt_snapshots
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  snap public.assessment_attempt_snapshots;
  sess public.learning_sessions;
  next_count integer;
  final_color public.result_color;
  v_caller uuid;
  v_is_admin boolean;
begin
  v_caller := public.current_staff_user_id();
  v_is_admin := coalesce(public.current_staff_is_admin(), false);

  if v_caller is null then
    raise exception 'Staff authentication required' using errcode = '42501';
  end if;

  if p_outcome not in ('fail', 'continue', 'done') then
    raise exception 'Invalid probe outcome %', p_outcome;
  end if;

  select ls.* into sess
  from public.assessment_attempts aa
  join public.learning_sessions ls on ls.id = aa.learning_session_id
  join public.classes c on c.id = ls.class_id
  where aa.id = p_attempt_id
    and (v_is_admin or c.teacher_user_id = v_caller or ls.owner_user_id = v_caller)
  for update of ls;

  if sess is null then
    raise exception 'Not authorized to resolve probe for this session' using errcode = '42501';
  end if;

  select * into snap
  from public.assessment_attempt_snapshots
  where attempt_id = p_attempt_id
  for update;

  if snap.status not in ('probe_open', 'resolution_required') then
    raise exception 'Probe resolution requires open Green probe';
  end if;

  if p_outcome in ('fail', 'done') then
    final_color := case when p_outcome = 'fail' then 'yellow'::public.result_color
                        else 'indigo'::public.result_color end;

    insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
    values (
      p_attempt_id,
      case when p_outcome = 'fail' then 'probe_failed'::public.assessment_event_type
           else 'probe_completed'::public.assessment_event_type end,
      jsonb_build_object('outcome', p_outcome),
      v_caller
    );

    insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
    values (p_attempt_id, 'result_finalized', jsonb_build_object('color', final_color), v_caller);

    update public.assessment_attempt_snapshots
    set status = 'finalized',
        probe_count = probe_count + case when p_outcome = 'done' and snap.status = 'probe_open' then 1 else 0 end,
        effective_color = final_color,
        effective_score = public.color_factor(final_color),
        finalized_at = now(),
        updated_at = now()
    where attempt_id = p_attempt_id
    returning * into snap;

    return snap;
  end if;

  next_count := snap.probe_count + 1;

  insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
  values (
    p_attempt_id,
    'probe_continued',
    jsonb_build_object('outcome', 'continue', 'probe_count', next_count, 'color', 'blue'),
    v_caller
  );

  update public.assessment_attempt_snapshots
  set probe_count = next_count,
      status = 'probe_open',
      updated_at = now()
  where attempt_id = p_attempt_id
  returning * into snap;

  return snap;
end;
$$;

create or replace function public.correct_final_result(
  p_attempt_id uuid,
  p_color public.result_color,
  p_reason text,
  p_actor_user_id uuid default null
)
returns public.assessment_attempt_snapshots
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  snap public.assessment_attempt_snapshots;
  sess public.learning_sessions;
  v_caller uuid;
  v_is_admin boolean;
begin
  v_caller := public.current_staff_user_id();
  v_is_admin := coalesce(public.current_staff_is_admin(), false);

  if v_caller is null then
    raise exception 'Staff authentication required' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Correction requires a non-empty reason';
  end if;

  select ls.* into sess
  from public.assessment_attempts aa
  join public.learning_sessions ls on ls.id = aa.learning_session_id
  join public.classes c on c.id = ls.class_id
  where aa.id = p_attempt_id
    and (v_is_admin or c.teacher_user_id = v_caller or ls.owner_user_id = v_caller)
  for update of ls;

  if sess is null then
    raise exception 'Not authorized to correct this session result' using errcode = '42501';
  end if;

  select * into snap
  from public.assessment_attempt_snapshots
  where attempt_id = p_attempt_id
  for update;

  if snap.status not in ('finalized', 'corrected') then
    raise exception 'Only finalized results can be corrected';
  end if;

  insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
  values (
    p_attempt_id,
    'result_corrected',
    jsonb_build_object('color', p_color, 'reason', p_reason, 'previous_color', snap.effective_color),
    v_caller
  );

  update public.assessment_attempt_snapshots
  set status = 'corrected',
      effective_color = p_color,
      effective_score = public.color_factor(p_color),
      updated_at = now()
  where attempt_id = p_attempt_id
  returning * into snap;

  return snap;
end;
$$;
