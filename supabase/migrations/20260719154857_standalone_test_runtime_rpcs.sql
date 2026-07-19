-- Database-owned standalone assignment, readiness, runtime, and result lifecycle.

create or replace function private.result_color_score(p_color public.result_color)
returns smallint language sql immutable set search_path=pg_catalog as $$
  select case p_color when 'red' then 0 when 'yellow' then 1 when 'green' then 2 when 'purple' then 3 end::smallint
$$;

create or replace function public.create_standalone_test_assignment(p_learner_user_id uuid, p_package_version_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_actor uuid; v_org uuid; v_number int; v_id uuid;
begin
  v_actor:=public.current_staff_user_id();
  select om.organization_id into v_org from public.organization_memberships om
  where om.user_id=p_learner_user_id and om.role='learner' limit 1;
  if v_actor is null or v_org is null or not private.staff_can_manage_standalone_test(v_org,p_learner_user_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  if not exists(select 1 from public.test_package_versions where id=p_package_version_id and status='published') then raise exception 'Published Package Version required'; end if;
  select coalesce(max(assignment_number),0)+1 into v_number from public.standalone_test_assignments where learner_user_id=p_learner_user_id and package_version_id=p_package_version_id;
  insert into public.standalone_test_assignments(organization_id,learner_user_id,package_version_id,assigned_by_user_id,assignment_number)
  values(v_org,p_learner_user_id,p_package_version_id,v_actor,v_number) returning id into v_id;
  return v_id;
end $$;

create or replace function public.prepare_standalone_test_run(p_assignment_id uuid,p_test_section_id uuid,p_language text,p_voice_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare a public.standalone_test_assignments%rowtype; s public.test_sections%rowtype; m public.section_measurement_snapshots%rowtype; c public.cci_categories%rowtype; v_run uuid; v_intro uuid; v_item_count int; v_audio_count int; v_hash text;
begin
  if p_language not in ('vi','en') or nullif(trim(p_voice_id),'') is null then raise exception 'Language and voice are required'; end if;
  select * into a from public.standalone_test_assignments where id=p_assignment_id and status='active';
  if a.id is null or not private.staff_can_manage_standalone_test(a.organization_id,a.learner_user_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into s from public.test_sections where id=p_test_section_id and package_version_id=a.package_version_id;
  if s.id is null then raise exception 'Section does not belong to assignment Package Version'; end if;
  select * into m from public.section_measurement_snapshots where test_section_id=s.id order by created_at desc limit 1;
  select * into c from public.cci_categories where id=m.cci_category_id;
  select id into v_intro from public.narration_variants where test_section_id=s.id and narration_target='section_intro' and language=p_language and voice_id=p_voice_id and approval_status='approved' and audio_asset_id is not null order by approved_at desc limit 1;
  select count(*) into v_item_count from public.test_items where section_id=s.id;
  select count(distinct i.id) into v_audio_count from public.test_items i join public.narration_variants n on n.test_item_id=i.id and n.narration_target='test_item' and n.language=p_language and n.voice_id=p_voice_id and n.approval_status='approved' and n.audio_asset_id is not null where i.section_id=s.id;
  v_hash:=encode(extensions.digest(concat_ws('|',a.package_version_id,s.id,m.id,p_language,p_voice_id,coalesce(v_intro::text,''),v_audio_count::text),'sha256'),'hex');
  select id into v_run from public.standalone_test_runs where assignment_id=a.id and test_section_id=s.id and status in ('draft','ready') order by created_at desc limit 1;
  if v_run is null then
    insert into public.standalone_test_runs(organization_id,assignment_id,learner_user_id,test_section_id,section_measurement_snapshot_id,attempt_number,prompt_language,voice_id,intro_narration_variant_id,session_number,target_cvr_ohm,cci_source_id,cci_name,cci_value,readiness_hash,status,created_by_user_id)
    values(a.organization_id,a.id,a.learner_user_id,s.id,m.id,coalesce((select max(attempt_number)+1 from public.standalone_test_runs where assignment_id=a.id and test_section_id=s.id),1),p_language,p_voice_id,v_intro,s.section_order,m.target_cvr_ohm,coalesce(c.metadata->>'sourceCciId',m.snapshot_metadata->>'sourceCciId','unknown'),m.cci_category_label,m.cci_value,v_hash,case when v_intro is not null and v_item_count=10 and v_audio_count=10 then 'ready' else 'draft' end,public.current_staff_user_id()) returning id into v_run;
  else
    update public.standalone_test_runs set prompt_language=p_language,voice_id=p_voice_id,intro_narration_variant_id=v_intro,readiness_hash=v_hash,status=case when v_intro is not null and v_item_count=10 and v_audio_count=10 then 'ready' else 'draft' end where id=v_run;
  end if;
  return jsonb_build_object('runId',v_run,'canStart',v_intro is not null and v_item_count=10 and v_audio_count=10,'readinessToken',v_hash,'introApproved',v_intro is not null,'itemCount',v_item_count,'approvedItemAudioCount',v_audio_count,'sessionNumber',s.section_order,'targetCvrOhm',m.target_cvr_ohm,'cciName',m.cci_category_label,'cciValue',m.cci_value,'itemCpd',m.target_cvr_ohm*m.cci_value);
end $$;

create or replace function public.start_standalone_test_run(p_run_id uuid,p_readiness_token text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare r public.standalone_test_runs%rowtype; v_inserted int;
begin
  select * into r from public.standalone_test_runs where id=p_run_id for update;
  if r.id is null or not private.staff_can_manage_standalone_test(r.organization_id,r.learner_user_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  if r.status<>'ready' or r.readiness_hash<>p_readiness_token then raise exception 'Run readiness changed; prepare again'; end if;
  if r.intro_narration_variant_id is null then raise exception 'Approved introduction narration required'; end if;
  insert into public.standalone_test_run_items(run_id,test_item_id,item_order,source_item_hash,prompt_text,narration_variant_id,audio_asset_id,target_cvr_ohm,cci_value)
  select r.id,i.id,i.item_order,encode(extensions.digest(concat_ws('|',i.id,i.updated_at,case when r.prompt_language='vi' then i.prompt_vi else i.prompt_en end),'sha256'),'hex'),case when r.prompt_language='vi' then i.prompt_vi else i.prompt_en end,n.id,n.audio_asset_id,r.target_cvr_ohm,r.cci_value
  from public.test_items i join lateral (select nv.id,nv.audio_asset_id from public.narration_variants nv where nv.test_item_id=i.id and nv.narration_target='test_item' and nv.language=r.prompt_language and nv.voice_id=r.voice_id and nv.approval_status='approved' and nv.audio_asset_id is not null order by nv.approved_at desc limit 1) n on true
  where i.section_id=r.test_section_id order by i.item_order on conflict do nothing;
  get diagnostics v_inserted=row_count;
  if (select count(*) from public.standalone_test_run_items where run_id=r.id)<>10 then raise exception 'Exactly ten approved item narrations are required'; end if;
  update public.standalone_test_runs set status='in_progress',started_at=coalesce(started_at,now()) where id=r.id;
  return jsonb_build_object('runId',r.id,'status','in_progress','itemCount',10,'insertedItems',v_inserted);
end $$;

create or replace function public.record_standalone_provisional_result(p_run_item_id uuid,p_color public.result_color)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare ri public.standalone_test_run_items%rowtype; r public.standalone_test_runs%rowtype; a public.standalone_test_attempts%rowtype; v_seq int:=0; v_status public.attempt_status; v_effective public.result_color;
begin
  select * into ri from public.standalone_test_run_items where id=p_run_item_id; select * into r from public.standalone_test_runs where id=ri.run_id and status='in_progress';
  if r.id is null or not private.staff_can_manage_standalone_test(r.organization_id,r.learner_user_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into a from public.standalone_test_attempts where run_item_id=ri.id;
  if a.id is null then
    insert into public.standalone_test_attempts(run_id,run_item_id,learner_user_id,teacher_user_id) values(r.id,ri.id,r.learner_user_id,public.current_staff_user_id()) returning * into a;
    insert into public.standalone_test_attempt_snapshots(attempt_id) values(a.id);
    insert into public.standalone_test_events(attempt_id,event_sequence,event_type,actor_user_id) values(a.id,1,'assessment_created',public.current_staff_user_id()); v_seq:=1;
  else
    select latest_event_sequence into v_seq from public.standalone_test_attempt_snapshots where attempt_id=a.id for update;
    if (select status from public.standalone_test_attempt_snapshots where attempt_id=a.id)<>'draft' then raise exception 'Provisional result already recorded'; end if;
  end if;
  insert into public.standalone_test_events(attempt_id,event_sequence,event_type,payload,actor_user_id) values(a.id,v_seq+1,'provisional_recorded',jsonb_build_object('color',p_color),public.current_staff_user_id()); v_seq:=v_seq+1;
  if p_color='green' then v_status:='probe_open'; v_effective:=null; else v_status:='finalized'; v_effective:=p_color; insert into public.standalone_test_events(attempt_id,event_sequence,event_type,payload,actor_user_id) values(a.id,v_seq+1,'result_finalized',jsonb_build_object('color',p_color),public.current_staff_user_id()); v_seq:=v_seq+1; end if;
  update public.standalone_test_attempt_snapshots set status=v_status,provisional_color=p_color,effective_color=v_effective,effective_score=case when v_effective is null then null else private.result_color_score(v_effective) end,entered_probe_flow=(p_color='green'),latest_event_sequence=v_seq,finalized_at=case when v_status='finalized' then now() else null end,updated_at=now() where attempt_id=a.id;
  return jsonb_build_object('attemptId',a.id,'status',v_status,'effectiveColor',v_effective,'probeCount',0);
end $$;

create or replace function public.resolve_standalone_probe(p_attempt_id uuid,p_outcome text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare s public.standalone_test_attempt_snapshots%rowtype; r public.standalone_test_runs%rowtype; v_seq int; v_color public.result_color; v_status public.attempt_status; v_probe int;
begin
  select run.* into r from public.standalone_test_attempts a join public.standalone_test_runs run on run.id=a.run_id where a.id=p_attempt_id;
  if r.id is null or not private.staff_can_manage_standalone_test(r.organization_id,r.learner_user_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into s from public.standalone_test_attempt_snapshots where attempt_id=p_attempt_id for update;
  if s.status not in ('probe_open','resolution_required') or p_outcome not in ('fail','continue','done') then raise exception 'Invalid probe transition'; end if;
  v_seq:=s.latest_event_sequence+1; v_probe:=s.probe_count;
  if p_outcome='continue' then
    if s.status='resolution_required' then raise exception 'Probe ceiling reached; Fail or Done required'; end if;
    v_probe:=v_probe+1; v_status:=case when v_probe>=s.max_probe_count then 'resolution_required'::public.attempt_status else 'probe_open'::public.attempt_status end;
    insert into public.standalone_test_events(attempt_id,event_sequence,event_type,payload,actor_user_id) values(p_attempt_id,v_seq,'probe_continued',jsonb_build_object('probe_count',v_probe),public.current_staff_user_id());
  else
    v_color:=case when p_outcome='fail' then 'yellow'::public.result_color else 'green'::public.result_color end; v_status:='finalized';
    insert into public.standalone_test_events(attempt_id,event_sequence,event_type,payload,actor_user_id) values(p_attempt_id,v_seq,case when p_outcome='fail' then 'probe_failed'::public.assessment_event_type else 'probe_completed'::public.assessment_event_type end,'{}',public.current_staff_user_id()); v_seq:=v_seq+1;
    insert into public.standalone_test_events(attempt_id,event_sequence,event_type,payload,actor_user_id) values(p_attempt_id,v_seq,'result_finalized',jsonb_build_object('color',v_color),public.current_staff_user_id());
  end if;
  update public.standalone_test_attempt_snapshots set status=v_status,probe_count=v_probe,effective_color=v_color,effective_score=case when v_color is null then null else private.result_color_score(v_color) end,latest_event_sequence=v_seq,finalized_at=case when v_status='finalized' then now() else finalized_at end,updated_at=now() where attempt_id=p_attempt_id;
  return jsonb_build_object('attemptId',p_attempt_id,'status',v_status,'effectiveColor',v_color,'probeCount',v_probe);
end $$;

create or replace function public.correct_standalone_final_result(p_attempt_id uuid,p_color public.result_color,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare s public.standalone_test_attempt_snapshots%rowtype; r public.standalone_test_runs%rowtype; v_seq int;
begin
  if nullif(trim(p_reason),'') is null then raise exception 'Correction reason required'; end if;
  select run.* into r from public.standalone_test_attempts a join public.standalone_test_runs run on run.id=a.run_id where a.id=p_attempt_id;
  if r.id is null or not private.staff_can_manage_standalone_test(r.organization_id,r.learner_user_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into s from public.standalone_test_attempt_snapshots where attempt_id=p_attempt_id for update;
  if s.status not in ('finalized','corrected') then raise exception 'Only finalized results can be corrected'; end if;
  v_seq:=s.latest_event_sequence+1;
  insert into public.standalone_test_events(attempt_id,event_sequence,event_type,payload,actor_user_id) values(p_attempt_id,v_seq,'result_corrected',jsonb_build_object('color',p_color,'reason',p_reason,'previous_color',s.effective_color),public.current_staff_user_id());
  update public.standalone_test_attempt_snapshots set status='corrected',effective_color=p_color,effective_score=private.result_color_score(p_color),latest_event_sequence=v_seq,corrected_at=now(),updated_at=now() where attempt_id=p_attempt_id;
  return jsonb_build_object('attemptId',p_attempt_id,'status','corrected','effectiveColor',p_color);
end $$;

create or replace function public.complete_standalone_test_run(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare r public.standalone_test_runs%rowtype; v_done int;
begin
  select * into r from public.standalone_test_runs where id=p_run_id for update;
  if r.id is null or not private.staff_can_manage_standalone_test(r.organization_id,r.learner_user_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  select count(*) into v_done from public.standalone_test_attempts a join public.standalone_test_attempt_snapshots s on s.attempt_id=a.id where a.run_id=r.id and s.status in ('finalized','corrected');
  if v_done<>10 then raise exception 'All ten items must be finalized before completion'; end if;
  update public.standalone_test_runs set status='completed',completed_at=now() where id=r.id;
  if not exists(select 1 from public.test_sections section where section.package_version_id=(select package_version_id from public.standalone_test_assignments where id=r.assignment_id) and not exists(select 1 from public.standalone_test_runs done where done.assignment_id=r.assignment_id and done.test_section_id=section.id and done.status='completed')) then update public.standalone_test_assignments set status='completed',completed_at=now() where id=r.assignment_id; end if;
  return jsonb_build_object('runId',r.id,'status','completed','finalizedItems',v_done);
end $$;

do $$ declare target regprocedure; begin
  for target in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_standalone_test_assignment','prepare_standalone_test_run','start_standalone_test_run','record_standalone_provisional_result','resolve_standalone_probe','correct_standalone_final_result','complete_standalone_test_run') loop
    execute format('revoke execute on function %s from public, anon',target);
    execute format('grant execute on function %s to authenticated, service_role',target);
  end loop;
end $$;
