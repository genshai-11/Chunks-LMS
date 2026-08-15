-- Correct hosted catalog RLS and remove default anon/PUBLIC execution from
-- privileged test-generation and CPD functions. This is additive/corrective;
-- previously applied migrations remain unchanged.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
drop policy if exists test_packages_staff_read on public.test_packages;
create policy test_packages_staff_read on public.test_packages
  for select to authenticated
  using (
    (select public.current_staff_is_admin())
    or exists (
      select 1
      from public.test_package_versions v
      where v.package_id = test_packages.id
        and v.status in ('published', 'archived')
    )
  );
-- Harden every overload of the named privileged functions without relying on
-- remembered signatures. Explicit grants are restored below only where needed.
do $$
declare
  target regprocedure;
begin
  for target in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'generate_test_item',
        'generate_narration',
        'approve_generated_asset',
        'get_learner_cpd_records',
        'calculate_learner_cpd_report'
      )
  loop
    execute format('revoke execute on function %s from public, anon', target);
    execute format('alter function %s set search_path = pg_catalog, public, extensions', target);
  end loop;
end $$;
-- Raw CPD records are internal to the authorized summary RPC.
revoke execute on function public.get_learner_cpd_records(uuid, uuid, uuid)
  from authenticated;
grant execute on function public.get_learner_cpd_records(uuid, uuid, uuid)
  to service_role;
-- Generation functions perform their own Admin checks and are invoked through
-- the JWT-verified Edge Function.
grant execute on function public.generate_test_item(uuid, uuid, text)
  to authenticated, service_role;
grant execute on function public.generate_narration(uuid, text, uuid, uuid, text, text)
  to authenticated, service_role;
grant execute on function public.approve_generated_asset(uuid, text)
  to authenticated, service_role;
-- Replace only the summary RPC to add caller authorization. The raw record RPC
-- remains service-role/internal and still supplies correction-aware records.
create or replace function public.calculate_learner_cpd_report(
  p_learner_user_id uuid,
  p_course_id uuid default null,
  p_class_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_total_attempts bigint;
  v_avg_item_cpd numeric;
  v_avg_learner_cpd_score numeric;
  v_items jsonb;
  v_provenance jsonb;
begin
  if not (
    public.current_staff_is_admin()
    or public.staff_can_read_user(p_learner_user_id)
    or public.current_user_id() = p_learner_user_id
  ) then
    raise exception 'Not authorized to read learner CPD records' using errcode = '42501';
  end if;

  select count(*),
         round(coalesce(avg(item_cpd), 0), 2),
         round(coalesce(avg(learner_cpd_score), 0), 2)
  into v_total_attempts, v_avg_item_cpd, v_avg_learner_cpd_score
  from public.get_learner_cpd_records(p_learner_user_id, p_course_id, p_class_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'attemptId', attempt_id,
    'learningSessionId', learning_session_id,
    'sessionQuestionId', session_question_id,
    'packageVersionId', package_version_id,
    'packageVersionLabel', package_version_label,
    'sectionMeasurementSnapshotId', section_measurement_snapshot_id,
    'targetCvrOhm', target_cvr_ohm,
    'cciValue', cci_value,
    'itemCpd', item_cpd,
    'effectiveColor', effective_color,
    'effectiveScore', effective_score,
    'learnerCpdScore', learner_cpd_score,
    'finalizedAt', finalized_at
  ) order by finalized_at desc), '[]'::jsonb)
  into v_items
  from public.get_learner_cpd_records(p_learner_user_id, p_course_id, p_class_id);

  select jsonb_build_object(
    'packageVersions', coalesce(jsonb_agg(distinct package_version_id)
      filter (where package_version_id is not null), '[]'::jsonb),
    'measurementSnapshots', coalesce(jsonb_agg(distinct section_measurement_snapshot_id)
      filter (where section_measurement_snapshot_id is not null), '[]'::jsonb)
  )
  into v_provenance
  from public.get_learner_cpd_records(p_learner_user_id, p_course_id, p_class_id);

  return jsonb_build_object(
    'learnerUserId', p_learner_user_id,
    'totalAttempts', v_total_attempts,
    'averageItemCpd', v_avg_item_cpd,
    'averageLearnerCpdScore', v_avg_learner_cpd_score,
    'items', v_items,
    'provenance', v_provenance
  );
end;
$$;
revoke execute on function public.calculate_learner_cpd_report(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.calculate_learner_cpd_report(uuid, uuid, uuid)
  to authenticated, service_role;
comment on function public.calculate_learner_cpd_report(uuid, uuid, uuid) is
  'Authorized correction-aware live-test CPD summary; raw record RPC is service-role only.';
