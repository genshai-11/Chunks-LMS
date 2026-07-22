-- Allow a teacher to stop a standalone Live Test session early and open summary/analysis.
-- This preserves item-level immutability: only finalized/corrected attempts count in analysis;
-- draft/probe-open items remain as operational history and are excluded from metrics.

create or replace function public.stop_standalone_test_run(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  r public.standalone_test_runs%rowtype;
  v_finalized int;
  v_total int;
begin
  select * into r
  from public.standalone_test_runs
  where id=p_run_id
  for update;

  if r.id is null or not private.staff_can_manage_standalone_test(r.organization_id,r.learner_user_id) then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  if r.status <> 'in_progress' then
    raise exception 'Only in-progress standalone runs can be stopped early';
  end if;

  select count(*) into v_total
  from public.standalone_test_run_items
  where run_id=r.id;

  select count(*) into v_finalized
  from public.standalone_test_attempts a
  join public.standalone_test_attempt_snapshots s on s.attempt_id=a.id
  where a.run_id=r.id
    and s.status in ('finalized','corrected');

  update public.standalone_test_runs
  set status='completed',
      completed_at=now()
  where id=r.id;

  if not exists(
    select 1
    from public.test_sections section
    where section.package_version_id=(
      select package_version_id
      from public.standalone_test_assignments
      where id=r.assignment_id
    )
    and not exists(
      select 1
      from public.standalone_test_runs done
      where done.assignment_id=r.assignment_id
        and done.test_section_id=section.id
        and done.status='completed'
    )
  ) then
    update public.standalone_test_assignments
    set status='completed',
        completed_at=now()
    where id=r.assignment_id;
  end if;

  return jsonb_build_object(
    'runId',r.id,
    'status','completed',
    'partial',v_finalized < v_total,
    'finalizedItems',v_finalized,
    'totalItems',v_total
  );
end;
$$;

revoke execute on function public.stop_standalone_test_run(uuid) from public, anon;
grant execute on function public.stop_standalone_test_run(uuid) to authenticated, service_role;

comment on function public.stop_standalone_test_run(uuid) is
  'Stops an in-progress standalone test run early; completed run remains analyzable from finalized/corrected items only.';
