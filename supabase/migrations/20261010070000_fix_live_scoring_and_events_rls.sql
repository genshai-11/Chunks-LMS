-- Migration: Fix live scoring RLS and session question attempt creation
-- Canonical PRD: docs/plans/PRD-V1-TEACHER-SCOPED-SYNC.md
-- Canonical Ontology: docs/architecture/ONTOLOGY.md
-- 1. Add insert policy on assessment_events for authenticated staff
-- 2. Add SECURITY DEFINER to create_attempt_snapshot trigger function
-- 3. Enhance create_session_question_attempt to support admin observation and participant_learner_ids
-- 4. Add snapshot self-healing to record_provisional_result

-- 1. Assessment events RLS insert policy
create policy events_staff_insert on public.assessment_events
  for insert to authenticated
  with check (
    (select public.current_staff_is_admin())
    or exists (
      select 1 from public.assessment_attempts aa
      where aa.id = attempt_id
    )
  );

-- 2. Trigger function for attempt snapshot creation with SECURITY DEFINER
create or replace function public.create_attempt_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  max_p integer;
begin
  select max_probe_count into max_p
  from public.learning_sessions
  where id = new.learning_session_id;

  insert into public.assessment_attempt_snapshots (
    attempt_id, status, max_probe_count
  ) values (
    new.id, 'draft', coalesce(max_p, 2)
  )
  on conflict (attempt_id) do nothing;

  insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
  values (new.id, 'assessment_created', '{}'::jsonb, new.teacher_user_id);

  return new;
end;
$$;

-- 3. Enhanced create_session_question_attempt
create or replace function public.create_session_question_attempt(
  p_learning_session_id uuid,
  p_teacher_user_id uuid,
  p_learner_user_id uuid,
  p_external_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  sess public.learning_sessions;
  next_sequence integer;
  question_row public.session_questions;
  attempt_row public.assessment_attempts;
  v_caller uuid;
  v_is_admin boolean;
begin
  v_caller := public.current_staff_user_id();
  v_is_admin := coalesce(public.current_staff_is_admin(), false);

  if v_caller is null then
    raise exception 'Staff authentication required' using errcode = '42501';
  end if;

  select ls.* into sess
  from public.learning_sessions ls
  join public.classes c on c.id = ls.class_id
  where ls.id = p_learning_session_id
    and ls.status = 'open'
    and (
      v_is_admin
      or c.teacher_user_id = v_caller
      or ls.owner_user_id = v_caller
      or c.teacher_user_id = p_teacher_user_id
      or ls.owner_user_id = p_teacher_user_id
    )
  for update of ls;

  if sess is null then
    raise exception 'Open Learning Session not found or teacher is not assigned';
  end if;

  -- Verify learner is enrolled OR is in session participant list
  if not (
    exists (
      select 1 from public.enrollments e
      where e.class_id = sess.class_id
        and e.learner_user_id = p_learner_user_id
        and e.status = 'active'
    )
    or (sess.participant_learner_ids is not null and sess.participant_learner_ids @> array[p_learner_user_id])
  ) then
    raise exception 'Learner is not actively enrolled in this class';
  end if;

  select coalesce(max(sequence_number), 0) + 1
  into next_sequence
  from public.session_questions
  where learning_session_id = p_learning_session_id;

  insert into public.session_questions (
    learning_session_id,
    sequence_number,
    external_ref
  ) values (
    p_learning_session_id,
    next_sequence,
    p_external_ref
  ) returning * into question_row;

  insert into public.assessment_attempts (
    learning_session_id,
    session_question_id,
    learner_user_id,
    teacher_user_id
  ) values (
    p_learning_session_id,
    question_row.id,
    p_learner_user_id,
    coalesce(p_teacher_user_id, v_caller)
  ) returning * into attempt_row;

  return jsonb_build_object(
    'question', to_jsonb(question_row),
    'attempt', to_jsonb(attempt_row)
  );
end;
$$;

-- 4. Self-healing record_provisional_result
create or replace function public.record_provisional_result(
  p_attempt_id uuid,
  p_color public.result_color,
  p_actor_user_id uuid
)
returns public.assessment_attempt_snapshots
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  snap public.assessment_attempt_snapshots;
  sess public.learning_sessions;
begin
  if p_color not in ('red', 'orange', 'green', 'purple') then
    raise exception 'Primary capture color must be Red, Orange, Green, or Purple';
  end if;

  select ls.* into sess
  from public.assessment_attempts aa
  join public.learning_sessions ls on ls.id = aa.learning_session_id
  where aa.id = p_attempt_id
  for update of ls;

  if sess is not null and sess.status = 'completed' then
    raise exception 'Cannot capture on completed Learning Session';
  end if;

  select * into snap
  from public.assessment_attempt_snapshots
  where attempt_id = p_attempt_id
  for update;

  if snap is null then
    -- Attempt recovery if attempt row exists in assessment_attempts
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

  insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
  values (p_attempt_id, 'provisional_recorded', jsonb_build_object('color', p_color), p_actor_user_id);

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
    values (p_attempt_id, 'result_finalized', jsonb_build_object('color', p_color), p_actor_user_id);

    update public.assessment_attempt_snapshots
    set status = 'finalized',
        provisional_color = p_color,
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
