-- Authorized correction-aware standalone Test Results read model.

create or replace function public.get_learner_standalone_test_results(p_learner_user_id uuid,p_package_id uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_org uuid; v_runs jsonb; v_total int; v_avg numeric;
begin
  select organization_id into v_org from public.organization_memberships where user_id=p_learner_user_id and role='learner' limit 1;
  if v_org is null then raise exception 'Learner organization not found'; end if;
  if not (public.current_user_id()=p_learner_user_id or private.staff_can_manage_standalone_test(v_org,p_learner_user_id)) then raise exception 'Not authorized' using errcode='42501'; end if;

  with records as (
    select a.id assignment_id,a.assignment_number,p.id package_id,p.title package_title,pv.id package_version_id,pv.version_label,
      r.id run_id,r.session_number,r.prompt_language,r.voice_id,r.target_cvr_ohm,r.cci_source_id,r.cci_name,r.cci_value,r.item_cpd,r.status run_status,r.started_at,r.completed_at,
      ri.item_order,ri.test_item_id,att.id attempt_id,s.status result_status,s.effective_color,s.effective_score,s.probe_count,s.corrected_at,
      case when s.status in ('finalized','corrected') then ri.item_cpd*s.effective_score else null end learner_cpd_score
    from public.standalone_test_assignments a
    join public.test_package_versions pv on pv.id=a.package_version_id
    join public.test_packages p on p.id=pv.package_id
    join public.standalone_test_runs r on r.assignment_id=a.id
    left join public.standalone_test_run_items ri on ri.run_id=r.id
    left join public.standalone_test_attempts att on att.run_item_id=ri.id
    left join public.standalone_test_attempt_snapshots s on s.attempt_id=att.id
    where a.learner_user_id=p_learner_user_id and (p_package_id is null or p.id=p_package_id)
  ), run_rows as (
    select assignment_id,assignment_number,package_id,package_title,package_version_id,version_label,run_id,session_number,prompt_language,voice_id,target_cvr_ohm,cci_source_id,cci_name,cci_value,item_cpd,run_status,started_at,completed_at,
      count(*) filter(where result_status in ('finalized','corrected')) finalized_count,
      count(*) filter(where effective_color='red') red_count,count(*) filter(where effective_color='yellow') yellow_count,count(*) filter(where effective_color='green') green_count,count(*) filter(where effective_color='purple') purple_count,
      round(avg(learner_cpd_score) filter(where learner_cpd_score is not null),2) average_learner_cpd_score,
      coalesce(jsonb_agg(jsonb_build_object('itemOrder',item_order,'testItemId',test_item_id,'attemptId',attempt_id,'status',result_status,'effectiveColor',effective_color,'effectiveScore',effective_score,'probeCount',probe_count,'itemCpd',item_cpd,'learnerCpdScore',learner_cpd_score,'correctedAt',corrected_at) order by item_order) filter(where item_order is not null),'[]'::jsonb) items
    from records group by assignment_id,assignment_number,package_id,package_title,package_version_id,version_label,run_id,session_number,prompt_language,voice_id,target_cvr_ohm,cci_source_id,cci_name,cci_value,item_cpd,run_status,started_at,completed_at
  )
  select coalesce(jsonb_agg(to_jsonb(run_rows) order by completed_at desc nulls last,started_at desc),'[]'::jsonb),count(*)::int,round(avg(average_learner_cpd_score),2)
  into v_runs,v_total,v_avg from run_rows;

  return jsonb_build_object('learnerUserId',p_learner_user_id,'runCount',v_total,'averageLearnerCpdScore',v_avg,'runs',v_runs);
end $$;

revoke execute on function public.get_learner_standalone_test_results(uuid,uuid) from public,anon;
grant execute on function public.get_learner_standalone_test_results(uuid,uuid) to authenticated,service_role;
comment on function public.get_learner_standalone_test_results(uuid,uuid) is 'Separate finalized/corrected standalone Test Results with immutable package/measurement/CPD provenance.';
