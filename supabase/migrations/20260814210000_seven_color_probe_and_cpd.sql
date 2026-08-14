-- Support 7-color probe outcomes (Yellow on fail, Indigo on done) and dynamic color values

alter type public.result_color add value if not exists 'orange';
alter type public.result_color add value if not exists 'blue';
alter type public.result_color add value if not exists 'indigo';

create or replace function private.result_color_score(p_color public.result_color)
returns numeric language sql immutable set search_path=pg_catalog as $$
  select case p_color
    when 'red' then 0.0
    when 'orange' then 0.166667
    when 'yellow' then 0.333333
    when 'green' then 0.5
    when 'blue' then 0.666667
    when 'indigo' then 0.833333
    when 'purple' then 1.0
  end::numeric
$$;

create or replace function public.resolve_standalone_probe(p_attempt_id uuid, p_outcome text)
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

  select * into s
  from public.standalone_test_attempt_snapshots
  where attempt_id=p_attempt_id
  for update;

  if s.status not in ('probe_open','resolution_required') or p_outcome not in ('fail','continue','done') then
    raise exception 'Invalid probe transition';
  end if;

  v_seq:=s.latest_event_sequence+1;
  v_probe:=s.probe_count;

  if p_outcome='continue' then
    v_probe:=v_probe+1;
    v_status:='probe_open';
    insert into public.standalone_test_events(attempt_id,event_sequence,event_type,payload,actor_user_id)
    values(p_attempt_id,v_seq,'probe_continued',jsonb_build_object('probe_count',v_probe),public.current_staff_user_id());
  else
    v_color:=case when p_outcome='fail' then 'yellow'::public.result_color else 'indigo'::public.result_color end;
    v_status:='finalized';
    insert into public.standalone_test_events(attempt_id,event_sequence,event_type,payload,actor_user_id)
    values(
      p_attempt_id,
      v_seq,
      case when p_outcome='fail' then 'probe_failed'::public.assessment_event_type else 'probe_completed'::public.assessment_event_type end,
      '{}',
      public.current_staff_user_id()
    );
    v_seq:=v_seq+1;
    insert into public.standalone_test_events(attempt_id,event_sequence,event_type,payload,actor_user_id)
    values(p_attempt_id,v_seq,'result_finalized',jsonb_build_object('color',v_color),public.current_staff_user_id());
  end if;

  update public.standalone_test_attempt_snapshots
  set status=v_status,
      probe_count=v_probe,
      effective_color=v_color,
      effective_score=case when v_color is null then null else private.result_color_score(v_color) end,
      latest_event_sequence=v_seq,
      finalized_at=case when v_status='finalized' then now() else finalized_at end,
      updated_at=now()
  where attempt_id=p_attempt_id;

  return jsonb_build_object('attemptId',p_attempt_id,'status',v_status,'effectiveColor',v_color,'probeCount',v_probe);
end;
$$;
