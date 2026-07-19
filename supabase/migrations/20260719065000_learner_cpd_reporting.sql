-- Live Test V2 Learner CPD Reporting Modules.
-- canonical path that calculates target_cvr_ohm * CCI and learner_cpd_score.

create or replace function public.get_learner_cpd_records(
  p_learner_user_id uuid,
  p_course_id uuid default null,
  p_class_id uuid default null
)
returns table (
  attempt_id uuid,
  learning_session_id uuid,
  session_question_id uuid,
  learner_user_id uuid,
  package_version_id uuid,
  package_version_label text,
  section_measurement_snapshot_id uuid,
  target_cvr_ohm numeric,
  cci_value numeric,
  item_cpd numeric,
  effective_color text,
  effective_score integer,
  learner_cpd_score numeric,
  finalized_at timestamptz
)
language plpgsql
security definer
as $$
begin
  return query
  select 
    aa.id as attempt_id,
    aa.learning_session_id,
    aa.session_question_id,
    aa.learner_user_id,
    ls.test_package_version_id as package_version_id,
    coalesce(tpv.version_label, 'legacy-import') as package_version_label,
    ls.section_measurement_snapshot_id,
    
    -- Derivation of target CVR (V2 snapshot target cvr ohm -> fallback to legacy unit_ohm)
    coalesce(
      sms.target_cvr_ohm::numeric,
      legacy_item.unit_ohm::numeric,
      0
    ) as target_cvr_ohm,
    
    -- Derivation of CCI (V2 snapshot cci_value -> fallback to legacy cci_value)
    coalesce(
      sms.cci_value::numeric,
      legacy_item.cci_value::numeric,
      0
    ) as cci_value,
    
    -- item_cpd = target_cvr_ohm * CCI
    coalesce(
      sms.target_cvr_ohm::numeric * sms.cci_value::numeric,
      legacy_item.unit_ohm::numeric * legacy_item.cci_value::numeric,
      0
    ) as item_cpd,
    
    snap.effective_color::text,
    snap.effective_score::integer,
    
    -- learner_cpd_score = item_cpd * effective_score
    coalesce(
      (coalesce(sms.target_cvr_ohm::numeric * sms.cci_value::numeric, legacy_item.unit_ohm::numeric * legacy_item.cci_value::numeric, 0)) * snap.effective_score::numeric,
      0
    ) as learner_cpd_score,
    
    snap.updated_at as finalized_at
    
  from public.assessment_attempts aa
  join public.assessment_attempt_snapshots snap on snap.attempt_id = aa.id
  join public.learning_sessions ls on ls.id = aa.learning_session_id
  join public.classes cls on cls.id = ls.class_id
  
  -- Left join package / snapshot catalogs
  left join public.section_measurement_snapshots sms on sms.id = ls.section_measurement_snapshot_id
  left join public.test_package_versions tpv on tpv.id = ls.test_package_version_id
  
  -- Left join legacy migration tables for backwards compatibility
  left join public.session_questions sq on sq.id = aa.session_question_id
  left join public.live_test_items legacy_item on ('live-test-item:' || legacy_item.id::text = sq.external_ref or 'live-test-item:' || legacy_item.id::text || ':v' || ls.test_package_version_id::text = sq.external_ref)
  
  where aa.learner_user_id = p_learner_user_id
    and snap.status in ('finalized', 'corrected')
    and (p_course_id is null or cls.course_id = p_course_id)
    and (p_class_id is null or cls.id = p_class_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Summary RPC for Learner CPD Report
-- ---------------------------------------------------------------------------

create or replace function public.calculate_learner_cpd_report(
  p_learner_user_id uuid,
  p_course_id uuid default null,
  p_class_id uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_total_attempts bigint;
  v_avg_item_cpd numeric;
  v_avg_learner_cpd_score numeric;
  v_items jsonb;
  v_provenance jsonb;
begin
  -- Get total attempts
  select count(*),
         round(coalesce(avg(item_cpd), 0), 2),
         round(coalesce(avg(learner_cpd_score), 0), 2)
  into v_total_attempts, v_avg_item_cpd, v_avg_learner_cpd_score
  from public.get_learner_cpd_records(p_learner_user_id, p_course_id, p_class_id);

  -- Retrieve all records as JSON array
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

  -- Compile version/snapshot provenance
  select jsonb_build_object(
    'packageVersions', coalesce(jsonb_agg(distinct package_version_id) filter (where package_version_id is not null), '[]'::jsonb),
    'measurementSnapshots', coalesce(jsonb_agg(distinct section_measurement_snapshot_id) filter (where section_measurement_snapshot_id is not null), '[]'::jsonb)
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

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant execute on function public.get_learner_cpd_records(uuid, uuid, uuid) to authenticated;
grant execute on function public.calculate_learner_cpd_report(uuid, uuid, uuid) to authenticated;
