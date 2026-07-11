-- Live assessment capture helpers.
-- Questions and their single assigned attempt are created atomically.

create or replace function public.create_session_question_attempt(
  p_learning_session_id uuid,
  p_teacher_user_id uuid,
  p_learner_user_id uuid,
  p_external_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sess public.learning_sessions;
  next_sequence integer;
  question_row public.session_questions;
  attempt_row public.assessment_attempts;
begin
  select ls.* into sess
  from public.learning_sessions ls
  join public.classes c on c.id = ls.class_id
  where ls.id = p_learning_session_id
    and ls.status = 'open'
    and c.teacher_user_id = p_teacher_user_id
  for update of ls;

  if sess is null then
    raise exception 'Open Learning Session not found or teacher is not assigned';
  end if;

  if not exists (
    select 1 from public.enrollments e
    where e.class_id = sess.class_id
      and e.learner_user_id = p_learner_user_id
      and e.status = 'active'
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
    p_teacher_user_id
  ) returning * into attempt_row;

  return jsonb_build_object(
    'question', to_jsonb(question_row),
    'attempt', to_jsonb(attempt_row)
  );
end;
$$;

grant execute on function public.create_session_question_attempt(uuid, uuid, uuid, text)
  to authenticated, anon;

-- Align database behavior with the current unlimited-depth probe domain rule.
create or replace function public.resolve_probe(
  p_attempt_id uuid,
  p_outcome text,
  p_actor_user_id uuid
)
returns public.assessment_attempt_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
  snap public.assessment_attempt_snapshots;
  next_count integer;
  final_color public.result_color;
begin
  if p_outcome not in ('fail', 'continue', 'done') then
    raise exception 'Invalid probe outcome %', p_outcome;
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
                        else 'green'::public.result_color end;

    insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
    values (
      p_attempt_id,
      case when p_outcome = 'fail' then 'probe_failed'::public.assessment_event_type
           else 'probe_completed'::public.assessment_event_type end,
      jsonb_build_object('outcome', p_outcome),
      p_actor_user_id
    );

    insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
    values (p_attempt_id, 'result_finalized', jsonb_build_object('color', final_color), p_actor_user_id);

    update public.assessment_attempt_snapshots
    set status = 'finalized',
        probe_count = probe_count + case when snap.status = 'probe_open' then 1 else 0 end,
        effective_color = final_color,
        effective_score = public.color_score(final_color),
        finalized_at = now(),
        updated_at = now()
    where attempt_id = p_attempt_id
    returning * into snap;

    return snap;
  end if;

  next_count := snap.probe_count + 1;
  insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
  values (p_attempt_id, 'probe_continued', jsonb_build_object('probe_count', next_count), p_actor_user_id);

  update public.assessment_attempt_snapshots
  set probe_count = next_count,
      status = 'probe_open',
      updated_at = now()
  where attempt_id = p_attempt_id
  returning * into snap;

  return snap;
end;
$$;
