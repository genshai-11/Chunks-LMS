-- Allow teachers to correct a previously finalized standalone test item.
-- Re-clicking a color on a finalized/corrected item appends correction events and updates
-- the snapshot to `corrected` for final colors, or re-opens probe flow for green.

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
  select * into ri
  from public.standalone_test_run_items
  where id = p_run_item_id;

  select * into r
  from public.standalone_test_runs
  where id = ri.run_id
    and status = 'in_progress';

  if r.id is null or not private.staff_can_manage_standalone_test(r.organization_id, r.learner_user_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into a
  from public.standalone_test_attempts
  where run_item_id = ri.id;

  if a.id is null then
    insert into public.standalone_test_attempts(run_id, run_item_id, learner_user_id, teacher_user_id)
    values (r.id, ri.id, r.learner_user_id, public.current_staff_user_id())
    returning * into a;

    insert into public.standalone_test_attempt_snapshots(attempt_id)
    values (a.id);

    insert into public.standalone_test_events(attempt_id, event_sequence, event_type, actor_user_id)
    values (a.id, 1, 'assessment_created', public.current_staff_user_id());

    v_seq := 1;
  else
    select * into s
    from public.standalone_test_attempt_snapshots
    where attempt_id = a.id
    for update;

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
      effective_score = case when v_effective is null then null else private.result_color_score(v_effective) end,
      entered_probe_flow = (p_color = 'green'),
      probe_count = case when p_color = 'green' then 0 else probe_count end,
      latest_event_sequence = v_seq,
      finalized_at = case when v_status in ('finalized', 'corrected') then now() else null end,
      updated_at = now()
  where attempt_id = a.id;

  return jsonb_build_object(
    'attemptId', a.id,
    'status', v_status,
    'effectiveColor', v_effective,
    'probeCount', case when p_color = 'green' then 0 else coalesce(s.probe_count, 0) end
  );
end;
$$;
