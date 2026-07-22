-- Allow authenticated staff to upsert assessment_attempt_snapshots for attempts they can manage.
-- The client sync path already upserts assessment_attempts first, then snapshots with on_conflict=attempt_id.
-- Without insert/update policies, Supabase returns 403 on assessment_attempt_snapshots upsert.

drop policy if exists snapshots_staff_insert on public.assessment_attempt_snapshots;
drop policy if exists snapshots_staff_update on public.assessment_attempt_snapshots;

create policy snapshots_staff_insert on public.assessment_attempt_snapshots
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.assessment_attempts aa
      left join public.learning_sessions ls on ls.id = aa.learning_session_id
      where aa.id = attempt_id
        and (
          (select public.current_staff_is_admin())
          or aa.teacher_user_id = (select public.current_staff_user_id())
          or ((select public.current_staff_has_role('teacher')) and ls.id is not null and (select public.current_teacher_owns_class(ls.class_id)))
        )
    )
  );

create policy snapshots_staff_update on public.assessment_attempt_snapshots
  for update to authenticated
  using (
    exists (
      select 1
      from public.assessment_attempts aa
      left join public.learning_sessions ls on ls.id = aa.learning_session_id
      where aa.id = attempt_id
        and (
          (select public.current_staff_is_admin())
          or aa.teacher_user_id = (select public.current_staff_user_id())
          or ((select public.current_staff_has_role('teacher')) and ls.id is not null and (select public.current_teacher_owns_class(ls.class_id)))
        )
    )
  )
  with check (
    exists (
      select 1
      from public.assessment_attempts aa
      left join public.learning_sessions ls on ls.id = aa.learning_session_id
      where aa.id = attempt_id
        and (
          (select public.current_staff_is_admin())
          or aa.teacher_user_id = (select public.current_staff_user_id())
          or ((select public.current_staff_has_role('teacher')) and ls.id is not null and (select public.current_teacher_owns_class(ls.class_id)))
        )
    )
  );
