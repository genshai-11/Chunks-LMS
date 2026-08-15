-- Improve Day 1 Observe and Analysis read/write paths.
-- Postgres does not automatically index FK columns; these are the hot filters used by
-- live capture loading, finalized ledger rebuilding, RLS checks, and session sync.

create index if not exists users_email_lower_idx
  on public.users (lower(email))
  where email is not null;
create index if not exists organization_memberships_org_user_idx
  on public.organization_memberships (organization_id, user_id);
create index if not exists organization_memberships_user_org_role_idx
  on public.organization_memberships (user_id, organization_id, role);
create index if not exists courses_org_idx
  on public.courses (organization_id);
create index if not exists classes_course_idx
  on public.classes (course_id);
create index if not exists classes_teacher_idx
  on public.classes (teacher_user_id);
create index if not exists enrollments_class_active_idx
  on public.enrollments (class_id, learner_user_id)
  where status = 'active';
create index if not exists enrollments_learner_idx
  on public.enrollments (learner_user_id);
create index if not exists scheduled_sessions_class_start_idx
  on public.scheduled_sessions (class_id, planned_start);
create index if not exists learning_sessions_class_started_idx
  on public.learning_sessions (class_id, started_at);
create index if not exists session_questions_session_sequence_idx
  on public.session_questions (learning_session_id, sequence_number);
create index if not exists assessment_attempts_session_idx
  on public.assessment_attempts (learning_session_id);
create index if not exists assessment_attempts_question_idx
  on public.assessment_attempts (session_question_id);
create index if not exists assessment_attempts_learner_session_idx
  on public.assessment_attempts (learner_user_id, learning_session_id);
create index if not exists assessment_attempts_teacher_session_idx
  on public.assessment_attempts (teacher_user_id, learning_session_id);
create index if not exists snapshots_finalized_attempt_idx
  on public.assessment_attempt_snapshots (attempt_id, finalized_at)
  where status in ('finalized', 'corrected');
create index if not exists attendance_records_session_idx
  on public.attendance_records (learning_session_id);
create index if not exists attendance_records_learner_idx
  on public.attendance_records (learner_user_id);
