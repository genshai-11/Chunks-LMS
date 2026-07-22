-- Standalone Live Test probes should not have an n/depth ceiling.
-- Continue may be pressed indefinitely; Fail/Done are teacher decisions, not forced by max_probe_count.
-- Also keep run completion dynamic for sections with non-10 item counts.

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
    v_color:=case when p_outcome='fail' then 'yellow'::public.result_color else 'green'::public.result_color end;
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

create or replace function public.complete_standalone_test_run(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  r public.standalone_test_runs%rowtype;
  v_done int;
  v_expected int;
begin
  select * into r
  from public.standalone_test_runs
  where id=p_run_id
  for update;

  if r.id is null or not private.staff_can_manage_standalone_test(r.organization_id,r.learner_user_id) then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  select count(*) into v_expected
  from public.standalone_test_run_items
  where run_id=r.id;

  select count(*) into v_done
  from public.standalone_test_attempts a
  join public.standalone_test_attempt_snapshots s on s.attempt_id=a.id
  where a.run_id=r.id
    and s.status in ('finalized','corrected');

  if v_expected <= 0 then
    raise exception 'Run has no items';
  end if;
  if v_done <> v_expected then
    raise exception 'All % items must be finalized before completion', v_expected;
  end if;

  update public.standalone_test_runs
  set status='completed',completed_at=now()
  where id=r.id;

  if not exists(
    select 1
    from public.test_sections section
    where section.package_version_id=(select package_version_id from public.standalone_test_assignments where id=r.assignment_id)
      and not exists(
        select 1
        from public.standalone_test_runs done
        where done.assignment_id=r.assignment_id
          and done.test_section_id=section.id
          and done.status='completed'
      )
  ) then
    update public.standalone_test_assignments
    set status='completed',completed_at=now()
    where id=r.assignment_id;
  end if;

  return jsonb_build_object('runId',r.id,'status','completed','finalizedItems',v_done,'expectedItems',v_expected);
end;
$$;

do $$
declare target regprocedure;
begin
  for target in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in ('resolve_standalone_probe','complete_standalone_test_run')
  loop
    execute format('revoke execute on function %s from public, anon',target);
    execute format('grant execute on function %s to authenticated, service_role',target);
  end loop;
end $$;
