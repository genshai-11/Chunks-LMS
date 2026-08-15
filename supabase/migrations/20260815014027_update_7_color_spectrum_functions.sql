-- Switch persisted scores and probe resolution to the 7-color spectrum.

alter table public.assessment_attempt_snapshots
  drop constraint if exists assessment_attempt_snapshots_effective_score_check;

alter table public.assessment_attempt_snapshots
  alter column effective_score type numeric using effective_score::numeric;

alter table public.standalone_test_attempt_snapshots
  drop constraint if exists standalone_test_attempt_snapshots_effective_score_check;

alter table public.standalone_test_attempt_snapshots
  alter column effective_score type numeric using effective_score::numeric;

create or replace function public.color_factor(c public.result_color)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case c
    when 'red' then 0.00
    when 'orange' then 0.17
    when 'yellow' then 0.33
    when 'green' then 0.50
    when 'blue' then 0.67
    when 'indigo' then 0.83
    when 'purple' then 1.00
  end::numeric;
$$;

create or replace function private.result_color_factor(p_color public.result_color)
returns numeric
language sql
stable
set search_path = pg_catalog, public
as $$
  select public.color_factor(p_color);
$$;

update public.assessment_attempt_snapshots
set effective_score = public.color_factor(effective_color)
where effective_color is not null;

update public.standalone_test_attempt_snapshots
set effective_score = public.color_factor(effective_color)
where effective_color is not null;

alter table public.assessment_attempt_snapshots
  add constraint assessment_attempt_snapshots_effective_score_check
  check (effective_score between 0 and 1);

alter table public.standalone_test_attempt_snapshots
  add constraint standalone_test_attempt_snapshots_effective_score_check
  check (effective_score between 0 and 1);

create or replace function public.record_provisional_result(
  p_attempt_id uuid,
  p_color public.result_color,
  p_actor_user_id uuid
)
returns public.assessment_attempt_snapshots
language plpgsql
security definer
set search_path = public
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

  if sess.status = 'completed' then
    raise exception 'Cannot capture on completed Learning Session';
  end if;

  select * into snap
  from public.assessment_attempt_snapshots
  where attempt_id = p_attempt_id
  for update;

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
                        else 'indigo'::public.result_color end;

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
        effective_score = public.color_factor(final_color),
        finalized_at = now(),
        updated_at = now()
    where attempt_id = p_attempt_id
    returning * into snap;

    return snap;
  end if;

  next_count := snap.probe_count + 1;
  insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
  values (p_attempt_id, 'probe_continued', jsonb_build_object('probe_count', next_count, 'color', 'blue'), p_actor_user_id);

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
  p_actor_user_id uuid
)
returns public.assessment_attempt_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
  snap public.assessment_attempt_snapshots;
begin
  select * into snap
  from public.assessment_attempt_snapshots
  where attempt_id = p_attempt_id
  for update;

  if snap.status not in ('finalized', 'corrected') then
    raise exception 'Only finalized results can be corrected';
  end if;

  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Correction requires a non-empty reason';
  end if;

  insert into public.assessment_events (attempt_id, event_type, payload, actor_user_id)
  values (
    p_attempt_id,
    'result_corrected',
    jsonb_build_object('color', p_color, 'reason', p_reason, 'previous_color', snap.effective_color),
    p_actor_user_id
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

create or replace function public.record_standalone_provisional_result(
  p_run_item_id uuid,
  p_color public.result_color
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  ri public.standalone_test_run_items%rowtype;
  r public.standalone_test_runs%rowtype;
  a public.standalone_test_attempts%rowtype;
  s public.standalone_test_attempt_snapshots%rowtype;
  v_seq int := 0;
  v_status public.attempt_status;
  v_effective public.result_color;
begin
  if p_color not in ('red', 'orange', 'green', 'purple') then
    raise exception 'Primary capture color must be Red, Orange, Green, or Purple';
  end if;

  select * into ri from public.standalone_test_run_items where id = p_run_item_id;
  select * into r from public.standalone_test_runs where id = ri.run_id and status = 'in_progress';

  if r.id is null or not private.staff_can_manage_standalone_test(r.organization_id, r.learner_user_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into a from public.standalone_test_attempts where run_item_id = ri.id;

  if a.id is null then
    insert into public.standalone_test_attempts(run_id, run_item_id, learner_user_id, teacher_user_id)
    values (r.id, ri.id, r.learner_user_id, public.current_staff_user_id()) returning * into a;
    insert into public.standalone_test_attempt_snapshots(attempt_id) values (a.id);
    insert into public.standalone_test_events(attempt_id, event_sequence, event_type, actor_user_id)
    values (a.id, 1, 'assessment_created', public.current_staff_user_id());
    v_seq := 1;
  else
    select * into s from public.standalone_test_attempt_snapshots where attempt_id = a.id for update;
    v_seq := s.latest_event_sequence;
    if s.status in ('probe_open', 'resolution_required') then
      raise exception 'Probe is open; use Fail, Continue, or Done before recording a different color';
    end if;
  end if;

  insert into public.standalone_test_events(attempt_id, event_sequence, event_type, payload, actor_user_id)
  values (
    a.id,
    v_seq + 1,
    case when s.status in ('finalized', 'corrected') then 'result_corrected'::public.assessment_event_type else 'provisional_recorded'::public.assessment_event_type end,
    jsonb_build_object('color', p_color, 'previous_color', s.effective_color),
    public.current_staff_user_id()
  );
  v_seq := v_seq + 1;

  if p_color = 'green' then
    v_status := 'probe_open';
    v_effective := null;
  else
    v_status := case when s.status in ('finalized', 'corrected') then 'corrected'::public.attempt_status else 'finalized'::public.attempt_status end;
    v_effective := p_color;
    insert into public.standalone_test_events(attempt_id, event_sequence, event_type, payload, actor_user_id)
    values (a.id, v_seq + 1, 'result_finalized', jsonb_build_object('color', p_color), public.current_staff_user_id());
    v_seq := v_seq + 1;
  end if;

  update public.standalone_test_attempt_snapshots
  set status = v_status,
      provisional_color = p_color,
      effective_color = v_effective,
      effective_score = case when v_effective is null then null else private.result_color_factor(v_effective) end,
      entered_probe_flow = (p_color = 'green'),
      probe_count = case when p_color = 'green' then 0 else probe_count end,
      latest_event_sequence = v_seq,
      finalized_at = case when v_status in ('finalized', 'corrected') then now() else null end,
      updated_at = now()
  where attempt_id = a.id;

  return jsonb_build_object('attemptId', a.id, 'status', v_status, 'effectiveColor', v_effective, 'probeCount', case when p_color = 'green' then 0 else coalesce(s.probe_count, 0) end);
end;
$$;

create or replace function public.resolve_standalone_probe(p_attempt_id uuid,p_outcome text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  s public.standalone_test_attempt_snapshots%rowtype;
  r public.standalone_test_runs%rowtype;
  v_seq int;
  v_color public.result_color;
  v_status public.attempt_status;
  v_probe int;
begin
  select run.* into r
  from public.standalone_test_attempts a
  join public.standalone_test_runs run on run.id=a.run_id
  where a.id=p_attempt_id;

  if r.id is null or not private.staff_can_manage_standalone_test(r.organization_id,r.learner_user_id) then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  select * into s from public.standalone_test_attempt_snapshots where attempt_id=p_attempt_id for update;

  if s.status not in ('probe_open','resolution_required') or p_outcome not in ('fail','continue','done') then
    raise exception 'Invalid probe transition';
  end if;

  v_seq:=s.latest_event_sequence+1;
  v_probe:=s.probe_count;

  if p_outcome='continue' then
    v_probe:=v_probe+1;
    v_status:='probe_open';
    insert into public.standalone_test_events(attempt_id,event_sequence,event_type,payload,actor_user_id)
    values(p_attempt_id,v_seq,'probe_continued',jsonb_build_object('probe_count',v_probe,'color','blue'),public.current_staff_user_id());
  else
    v_color:=case when p_outcome='fail' then 'yellow'::public.result_color else 'indigo'::public.result_color end;
    v_status:='finalized';
    insert into public.standalone_test_events(attempt_id,event_sequence,event_type,payload,actor_user_id)
    values(p_attempt_id,v_seq,case when p_outcome='fail' then 'probe_failed'::public.assessment_event_type else 'probe_completed'::public.assessment_event_type end,'{}',public.current_staff_user_id());
    v_seq:=v_seq+1;
    insert into public.standalone_test_events(attempt_id,event_sequence,event_type,payload,actor_user_id)
    values(p_attempt_id,v_seq,'result_finalized',jsonb_build_object('color',v_color),public.current_staff_user_id());
    v_probe:=v_probe+1;
  end if;

  update public.standalone_test_attempt_snapshots
  set status=v_status,
      probe_count=v_probe,
      effective_color=v_color,
      effective_score=case when v_color is null then null else private.result_color_factor(v_color) end,
      latest_event_sequence=v_seq,
      finalized_at=case when v_status='finalized' then now() else finalized_at end,
      updated_at=now()
  where attempt_id=p_attempt_id;

  return jsonb_build_object('attemptId',p_attempt_id,'status',v_status,'effectiveColor',v_color,'probeCount',v_probe);
end;
$$;

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
  update public.standalone_test_attempt_snapshots set status='corrected',effective_color=p_color,effective_score=private.result_color_factor(p_color),latest_event_sequence=v_seq,corrected_at=now(),updated_at=now() where attempt_id=p_attempt_id;
  return jsonb_build_object('attemptId',p_attempt_id,'status','corrected','effectiveColor',p_color);
end $$;

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
      count(*) filter(where effective_color='red') red_count,
      count(*) filter(where effective_color='orange') orange_count,
      count(*) filter(where effective_color='yellow') yellow_count,
      count(*) filter(where effective_color='green') green_count,
      count(*) filter(where effective_color='blue') blue_count,
      count(*) filter(where effective_color='indigo') indigo_count,
      count(*) filter(where effective_color='purple') purple_count,
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
