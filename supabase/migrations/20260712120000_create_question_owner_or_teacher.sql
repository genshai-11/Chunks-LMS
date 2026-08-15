-- Allow capture RPC when p_teacher matches class.teacher OR learning_sessions.owner_user_id.
-- Prevents false "teacher not assigned" when owner is set at Start session.

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
    and (
      c.teacher_user_id = p_teacher_user_id
      or ls.owner_user_id = p_teacher_user_id
    )
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
