-- Migration: Serialize standalone test events to prevent unique constraint conflicts on rapid clicks
-- Canonical PRD: docs/plans/PRD-V1-TEACHER-SCOPED-SYNC.md
-- Canonical Ontology: docs/architecture/ONTOLOGY.md
-- 1. Adds row locking (FOR UPDATE) to standalone_test_run_items and standalone_test_attempt_snapshots
-- 2. Dynamically calculates next event_sequence from max(event_sequence) to eliminate race conditions
-- 3. Adds ON CONFLICT handling on assessment attempt creation

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

  -- Lock the run item to serialize attempts creation
  select * into ri from public.standalone_test_run_items where id = p_run_item_id for update;
  if ri.id is null then
    raise exception 'Run item not found';
  end if;

  select * into r from public.standalone_test_runs where id = ri.run_id and status = 'in_progress';
  if r.id is null or not private.staff_can_manage_standalone_test(r.organization_id, r.learner_user_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into a from public.standalone_test_attempts where run_item_id = ri.id for update;

  if a.id is null then
    insert into public.standalone_test_attempts(run_id, run_item_id, learner_user_id, teacher_user_id)
    values (r.id, ri.id, r.learner_user_id, public.current_staff_user_id())
    on conflict (run_id, run_item_id) do nothing
    returning * into a;

    if a.id is null then
      select * into a from public.standalone_test_attempts where run_item_id = ri.id for update;
    else
      insert into public.standalone_test_attempt_snapshots(attempt_id)
      values (a.id)
      on conflict (attempt_id) do nothing;

      insert into public.standalone_test_events(attempt_id, event_sequence, event_type, actor_user_id)
      values (a.id, 1, 'assessment_created', public.current_staff_user_id())
      on conflict (attempt_id, event_sequence) do nothing;

      v_seq := 1;
    end if;
  end if;

  select * into s from public.standalone_test_attempt_snapshots where attempt_id = a.id for update;

  if s.status in ('probe_open', 'resolution_required') then
    raise exception 'Probe is open; use Fail, Continue, or Done before recording a different color';
  end if;

  -- Compute next sequence dynamically from table to prevent any conflict
  select coalesce(max(event_sequence), s.latest_event_sequence, 0)
  into v_seq
  from public.standalone_test_events
  where attempt_id = a.id;

  v_seq := v_seq + 1;
  insert into public.standalone_test_events(attempt_id, event_sequence, event_type, payload, actor_user_id)
  values (
    a.id,
    v_seq,
    case when s.status in ('finalized', 'corrected') then 'result_corrected'::public.assessment_event_type else 'provisional_recorded'::public.assessment_event_type end,
    jsonb_build_object('color', p_color, 'previous_color', s.effective_color),
    public.current_staff_user_id()
  )
  on conflict (attempt_id, event_sequence) do update
  set payload = excluded.payload, updated_at = now();

  if p_color = 'green' then
    v_status := 'probe_open';
    v_effective := null;
  else
    v_status := case when s.status in ('finalized', 'corrected') then 'corrected'::public.attempt_status else 'finalized'::public.attempt_status end;
    v_effective := p_color;

    v_seq := v_seq + 1;
    insert into public.standalone_test_events(attempt_id, event_sequence, event_type, payload, actor_user_id)
    values (a.id, v_seq, 'result_finalized', jsonb_build_object('color', p_color), public.current_staff_user_id())
    on conflict (attempt_id, event_sequence) do update
    set payload = excluded.payload, updated_at = now();
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

  return jsonb_build_object('attemptId', a.id, 'status', v_status, 'effectiveColor', v_effective, 'probeCount', 0);
end $$;

create or replace function public.resolve_standalone_probe(
  p_attempt_id uuid,
  p_outcome text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  r public.standalone_test_runs%rowtype;
  s public.standalone_test_attempt_snapshots%rowtype;
  v_seq int;
  v_probe int;
  v_status public.attempt_status;
  v_color public.result_color;
begin
  select run.* into r
  from public.standalone_test_attempts a
  join public.standalone_test_runs run on run.id = a.run_id
  where a.id = p_attempt_id;

  if r.id is null or not private.staff_can_manage_standalone_test(r.organization_id, r.learner_user_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- Lock the attempt snapshot row for update to serialize probe resolution
  select * into s from public.standalone_test_attempt_snapshots where attempt_id = p_attempt_id for update;

  if s.status not in ('probe_open', 'resolution_required') or p_outcome not in ('fail', 'continue', 'done') then
    raise exception 'Invalid probe transition';
  end if;

  -- Calculate next sequence dynamically
  select coalesce(max(event_sequence), s.latest_event_sequence, 0) + 1
  into v_seq
  from public.standalone_test_events
  where attempt_id = p_attempt_id;

  v_probe := s.probe_count;

  if p_outcome = 'continue' then
    v_probe := v_probe + 1;
    v_status := 'probe_open';

    insert into public.standalone_test_events(attempt_id, event_sequence, event_type, payload, actor_user_id)
    values(p_attempt_id, v_seq, 'probe_continued', jsonb_build_object('probe_count', v_probe, 'color', 'blue'), public.current_staff_user_id())
    on conflict (attempt_id, event_sequence) do update
    set payload = excluded.payload, updated_at = now();
  else
    v_color := case when p_outcome = 'fail' then 'yellow'::public.result_color else 'indigo'::public.result_color end;
    v_status := 'finalized';

    insert into public.standalone_test_events(attempt_id, event_sequence, event_type, payload, actor_user_id)
    values(p_attempt_id, v_seq, case when p_outcome = 'fail' then 'probe_failed'::public.assessment_event_type else 'probe_completed'::public.assessment_event_type end, '{}', public.current_staff_user_id())
    on conflict (attempt_id, event_sequence) do update
    set payload = excluded.payload, updated_at = now();

    v_seq := v_seq + 1;
    insert into public.standalone_test_events(attempt_id, event_sequence, event_type, payload, actor_user_id)
    values(p_attempt_id, v_seq, 'result_finalized', jsonb_build_object('color', v_color), public.current_staff_user_id())
    on conflict (attempt_id, event_sequence) do update
    set payload = excluded.payload, updated_at = now();

    if p_outcome = 'done' then
      v_probe := v_probe + 1;
    end if;
  end if;

  update public.standalone_test_attempt_snapshots
  set status = v_status,
      probe_count = v_probe,
      effective_color = v_color,
      effective_score = case when v_color is null then null else private.result_color_factor(v_color) end,
      latest_event_sequence = v_seq,
      finalized_at = case when v_status = 'finalized' then now() else finalized_at end,
      updated_at = now()
  where attempt_id = p_attempt_id;

  return jsonb_build_object('attemptId', p_attempt_id, 'status', v_status, 'effectiveColor', v_color, 'probeCount', v_probe);
end $$;
