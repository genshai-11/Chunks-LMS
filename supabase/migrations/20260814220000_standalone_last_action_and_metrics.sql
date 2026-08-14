-- Last-action-wins standalone capture while preserving append-only event history.
-- Also align persisted seven-color scores with the normalized 0..1 domain weights.

create or replace function private.result_color_score(p_color public.result_color)
returns numeric
language sql
immutable
set search_path = pg_catalog
as $$
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


-- The class/session lifecycle stores an ordinal rank. Keep that public contract
-- integer-based but extend it to all seven colors. Normalized CPD weights remain
-- centralized in the domain layer and in standalone snapshots below.
create or replace function public.color_score(c public.result_color)
returns smallint
language sql
immutable
set search_path = pg_catalog
as $$
  select case c
    when 'red' then 0
    when 'orange' then 1
    when 'yellow' then 2
    when 'green' then 3
    when 'blue' then 4
    when 'indigo' then 5
    when 'purple' then 6
  end::smallint
$$;

alter table public.assessment_attempt_snapshots
  drop constraint if exists assessment_attempt_snapshots_effective_score_check;
update public.assessment_attempt_snapshots
set effective_score = public.color_score(effective_color)
where effective_color is not null;
alter table public.assessment_attempt_snapshots
  add constraint assessment_attempt_snapshots_effective_score_check
  check (effective_score between 0 and 6);

alter table public.standalone_test_attempt_snapshots
  drop constraint if exists standalone_test_attempt_snapshots_effective_score_check;
alter table public.standalone_test_attempt_snapshots
  alter column effective_score type numeric using effective_score::numeric;
update public.standalone_test_attempt_snapshots
set effective_score = private.result_color_score(effective_color)
where effective_color is not null;
alter table public.standalone_test_attempt_snapshots
  add constraint standalone_test_attempt_snapshots_effective_score_check
  check (effective_score between 0 and 1);

alter table public.standalone_test_attempt_snapshots
  add column if not exists client_revision bigint not null default 0
  check (client_revision >= 0);

-- Metric versions are immutable. Add new definitions rather than rewriting 1.0 history.
insert into public.metric_versions (
  template_id, version, definition, formula, min_sample, unit, direction, status
)
select
  template.id,
  '2.0.0',
  definition.definition,
  definition.formula,
  1,
  definition.unit,
  definition.direction::public.metric_direction,
  'operational'::public.metric_status
from public.metric_templates template
join (
  values
    ('rfc', 'Warm finalized MAIN results (Red + Orange + Yellow) / finalized MAIN sample', '(red+orange+yellow)/finalized_main', 'ratio', 'lower_better'),
    ('rac', 'Cool finalized MAIN results (Green + Blue + Indigo + Purple) / finalized MAIN sample = 1 - RFC', '1-rfc', 'ratio', 'higher_better'),
    ('average_performance', 'Mean normalized effective-result color weight 0..1 over finalized MAIN sample', 'sum(effective_weight)/finalized_main', 'score', 'higher_better')
) as definition(key, definition, formula, unit, direction)
  on definition.key = template.key
on conflict (template_id, version) do nothing;

create or replace function public.apply_standalone_result_command(
  p_run_item_id uuid,
  p_action text,
  p_color public.result_color default null,
  p_outcome text default null,
  p_client_revision bigint default 0
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
  v_seq integer;
  v_status public.attempt_status;
  v_effective public.result_color;
  v_probe integer;
  v_created boolean := false;
  v_event_type public.assessment_event_type;
begin
  if p_action not in ('record', 'probe') or p_client_revision <= 0 then
    raise exception 'Invalid standalone result command';
  end if;
  if p_action = 'record' and p_color is null then
    raise exception 'Result color is required';
  end if;
  if p_action = 'probe' and p_outcome not in ('fail', 'continue', 'done') then
    raise exception 'Invalid probe outcome';
  end if;

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
    on conflict (run_id, run_item_id) do nothing
    returning * into a;

    if a.id is null then
      select * into a
      from public.standalone_test_attempts
      where run_id = r.id and run_item_id = ri.id;
    else
      v_created := true;
    end if;

    insert into public.standalone_test_attempt_snapshots(attempt_id)
    values (a.id)
    on conflict (attempt_id) do nothing;
  end if;

  select * into s
  from public.standalone_test_attempt_snapshots
  where attempt_id = a.id
  for update;

  if p_client_revision <= s.client_revision then
    return jsonb_build_object(
      'attemptId', a.id,
      'status', s.status,
      'effectiveColor', s.effective_color,
      'probeCount', s.probe_count,
      'clientRevision', s.client_revision,
      'stale', true
    );
  end if;

  v_seq := s.latest_event_sequence;
  if v_created and v_seq = 0 then
    v_seq := 1;
    insert into public.standalone_test_events(
      attempt_id, event_sequence, event_type, payload, actor_user_id
    ) values (
      a.id,
      v_seq,
      'assessment_created',
      jsonb_build_object('clientRevision', p_client_revision),
      public.current_staff_user_id()
    );
  end if;

  -- A probe click may reach Postgres before its optimistic Green command. The probe
  -- command is sufficient evidence of that preceding UI transition, so synthesize the
  -- missing Green event in the same immutable transaction rather than losing the click.
  if p_action = 'probe' and s.status = 'draft' and v_created then
    v_seq := v_seq + 1;
    insert into public.standalone_test_events(
      attempt_id, event_sequence, event_type, payload, actor_user_id
    ) values (
      a.id,
      v_seq,
      'provisional_recorded',
      jsonb_build_object('color', 'green', 'clientRevision', p_client_revision, 'reconciled', true),
      public.current_staff_user_id()
    );
    s.status := 'probe_open';
    s.provisional_color := 'green';
    s.entered_probe_flow := true;
  end if;

  if p_action = 'record' then
    v_event_type := case
      when s.status in ('finalized', 'corrected') then 'result_corrected'::public.assessment_event_type
      else 'provisional_recorded'::public.assessment_event_type
    end;
    v_seq := v_seq + 1;
    insert into public.standalone_test_events(
      attempt_id, event_sequence, event_type, payload, actor_user_id
    ) values (
      a.id,
      v_seq,
      v_event_type,
      jsonb_build_object(
        'color', p_color,
        'previous_color', s.effective_color,
        'reason', case when v_event_type = 'result_corrected' then 'teacher_last_action' else null end,
        'clientRevision', p_client_revision
      ),
      public.current_staff_user_id()
    );

    if p_color = 'green' then
      v_status := 'probe_open';
      v_effective := null;
      v_probe := 0;
    else
      v_status := case
        when s.status in ('finalized', 'corrected') or s.corrected_at is not null then 'corrected'::public.attempt_status
        else 'finalized'::public.attempt_status
      end;
      v_effective := p_color;
      v_probe := s.probe_count;
      v_seq := v_seq + 1;
      insert into public.standalone_test_events(
        attempt_id, event_sequence, event_type, payload, actor_user_id
      ) values (
        a.id,
        v_seq,
        'result_finalized',
        jsonb_build_object('color', p_color, 'clientRevision', p_client_revision),
        public.current_staff_user_id()
      );
    end if;

    update public.standalone_test_attempt_snapshots
    set status = v_status,
        provisional_color = p_color,
        effective_color = v_effective,
        effective_score = case when v_effective is null then null else private.result_color_score(v_effective) end,
        probe_count = v_probe,
        entered_probe_flow = entered_probe_flow or p_color = 'green',
        latest_event_sequence = v_seq,
        client_revision = p_client_revision,
        finalized_at = case when v_effective is null then null else now() end,
        corrected_at = case when v_status = 'corrected' then now() else corrected_at end,
        updated_at = now()
    where attempt_id = a.id;
  else
    if s.status not in ('probe_open', 'resolution_required') then
      raise exception 'Probe is not open';
    end if;
    v_probe := s.probe_count;
    v_seq := v_seq + 1;

    if p_outcome = 'continue' then
      v_probe := v_probe + 1;
      v_status := 'probe_open';
      v_effective := null;
      insert into public.standalone_test_events(
        attempt_id, event_sequence, event_type, payload, actor_user_id
      ) values (
        a.id,
        v_seq,
        'probe_continued',
        jsonb_build_object('probe_count', v_probe, 'clientRevision', p_client_revision),
        public.current_staff_user_id()
      );
    else
      v_effective := case
        when p_outcome = 'fail' then 'yellow'::public.result_color
        else 'indigo'::public.result_color
      end;
      v_status := case
        when s.corrected_at is not null then 'corrected'::public.attempt_status
        else 'finalized'::public.attempt_status
      end;
      insert into public.standalone_test_events(
        attempt_id, event_sequence, event_type, payload, actor_user_id
      ) values (
        a.id,
        v_seq,
        case when p_outcome = 'fail' then 'probe_failed'::public.assessment_event_type else 'probe_completed'::public.assessment_event_type end,
        jsonb_build_object('clientRevision', p_client_revision),
        public.current_staff_user_id()
      );
      v_seq := v_seq + 1;
      insert into public.standalone_test_events(
        attempt_id, event_sequence, event_type, payload, actor_user_id
      ) values (
        a.id,
        v_seq,
        'result_finalized',
        jsonb_build_object('color', v_effective, 'clientRevision', p_client_revision),
        public.current_staff_user_id()
      );
    end if;

    update public.standalone_test_attempt_snapshots
    set status = v_status,
        provisional_color = coalesce(provisional_color, 'green'::public.result_color),
        entered_probe_flow = true,
        probe_count = v_probe,
        effective_color = v_effective,
        effective_score = case when v_effective is null then null else private.result_color_score(v_effective) end,
        latest_event_sequence = v_seq,
        client_revision = p_client_revision,
        finalized_at = case when v_effective is null then finalized_at else now() end,
        corrected_at = case when v_status = 'corrected' then now() else corrected_at end,
        updated_at = now()
    where attempt_id = a.id;
  end if;

  select * into s
  from public.standalone_test_attempt_snapshots
  where attempt_id = a.id;

  return jsonb_build_object(
    'attemptId', a.id,
    'status', s.status,
    'effectiveColor', s.effective_color,
    'probeCount', s.probe_count,
    'clientRevision', s.client_revision,
    'stale', false
  );
end;
$$;

revoke execute on function public.apply_standalone_result_command(uuid, text, public.result_color, text, bigint)
  from public, anon;
grant execute on function public.apply_standalone_result_command(uuid, text, public.result_color, text, bigint)
  to authenticated, service_role;

comment on function public.apply_standalone_result_command(uuid, text, public.result_color, text, bigint) is
  'Append-only standalone result command. Per-item client revisions make the final user action durable even when requests arrive out of order.';

-- Keep legacy RPC clients on the same authority instead of retaining divergent four-color
-- probe/rescore behavior. Timestamp-derived revisions sort after historical zero revisions.
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
  v_revision bigint;
begin
  select greatest(
    coalesce(snapshot.client_revision, 0) + 1,
    floor(extract(epoch from clock_timestamp()) * 1000000)::bigint
  )
  into v_revision
  from public.standalone_test_run_items run_item
  left join public.standalone_test_attempts attempt on attempt.run_item_id = run_item.id
  left join public.standalone_test_attempt_snapshots snapshot on snapshot.attempt_id = attempt.id
  where run_item.id = p_run_item_id;

  return public.apply_standalone_result_command(
    p_run_item_id,
    'record',
    p_color,
    null,
    coalesce(v_revision, floor(extract(epoch from clock_timestamp()) * 1000000)::bigint)
  );
end;
$$;

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
  v_run_item_id uuid;
  v_revision bigint;
begin
  select
    attempt.run_item_id,
    greatest(
      snapshot.client_revision + 1,
      floor(extract(epoch from clock_timestamp()) * 1000000)::bigint
    )
  into v_run_item_id, v_revision
  from public.standalone_test_attempts attempt
  join public.standalone_test_attempt_snapshots snapshot on snapshot.attempt_id = attempt.id
  where attempt.id = p_attempt_id;

  if v_run_item_id is null then raise exception 'Probe is not open'; end if;
  return public.apply_standalone_result_command(
    v_run_item_id,
    'probe',
    null,
    p_outcome,
    v_revision
  );
end;
$$;

revoke execute on function public.record_standalone_provisional_result(uuid, public.result_color)
  from public, anon;
revoke execute on function public.resolve_standalone_probe(uuid, text)
  from public, anon;
grant execute on function public.record_standalone_provisional_result(uuid, public.result_color)
  to authenticated, service_role;
grant execute on function public.resolve_standalone_probe(uuid, text)
  to authenticated, service_role;

-- Correction-aware seven-color learner result read model. The finalized count is the
-- main-item metric sample; probe steps remain available from the event ledger separately.
create or replace function public.get_learner_standalone_test_results(
  p_learner_user_id uuid,
  p_package_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_org uuid;
  v_runs jsonb;
  v_total integer;
  v_avg numeric;
begin
  select organization_id into v_org
  from public.organization_memberships
  where user_id = p_learner_user_id and role = 'learner'
  limit 1;
  if v_org is null then raise exception 'Learner organization not found'; end if;
  if not (
    public.current_user_id() = p_learner_user_id
    or private.staff_can_manage_standalone_test(v_org, p_learner_user_id)
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  with records as (
    select
      a.id assignment_id,
      a.assignment_number,
      p.id package_id,
      p.title package_title,
      pv.id package_version_id,
      pv.version_label,
      r.id run_id,
      r.session_number,
      r.prompt_language,
      r.voice_id,
      r.target_cvr_ohm,
      r.cci_source_id,
      r.cci_name,
      r.cci_value,
      r.item_cpd,
      r.status run_status,
      r.started_at,
      r.completed_at,
      ri.item_order,
      ri.test_item_id,
      att.id attempt_id,
      s.status result_status,
      s.effective_color,
      s.effective_score,
      s.probe_count,
      s.corrected_at,
      case
        when s.status in ('finalized', 'corrected') then ri.item_cpd * s.effective_score
        else null
      end learner_cpd_score
    from public.standalone_test_assignments a
    join public.test_package_versions pv on pv.id = a.package_version_id
    join public.test_packages p on p.id = pv.package_id
    join public.standalone_test_runs r on r.assignment_id = a.id
    left join public.standalone_test_run_items ri on ri.run_id = r.id
    left join public.standalone_test_attempts att on att.run_item_id = ri.id
    left join public.standalone_test_attempt_snapshots s on s.attempt_id = att.id
    where a.learner_user_id = p_learner_user_id
      and (p_package_id is null or p.id = p_package_id)
  ), run_rows as (
    select
      assignment_id,
      assignment_number,
      package_id,
      package_title,
      package_version_id,
      version_label,
      run_id,
      session_number,
      prompt_language,
      voice_id,
      target_cvr_ohm,
      cci_source_id,
      cci_name,
      cci_value,
      item_cpd,
      run_status,
      started_at,
      completed_at,
      count(*) filter (where result_status in ('finalized', 'corrected')) finalized_count,
      count(*) filter (where result_status in ('finalized', 'corrected') and effective_color = 'red') red_count,
      count(*) filter (where result_status in ('finalized', 'corrected') and effective_color = 'orange') orange_count,
      count(*) filter (where result_status in ('finalized', 'corrected') and effective_color = 'yellow') yellow_count,
      count(*) filter (where result_status in ('finalized', 'corrected') and effective_color = 'green') green_count,
      count(*) filter (where result_status in ('finalized', 'corrected') and effective_color = 'blue') blue_count,
      count(*) filter (where result_status in ('finalized', 'corrected') and effective_color = 'indigo') indigo_count,
      count(*) filter (where result_status in ('finalized', 'corrected') and effective_color = 'purple') purple_count,
      round(avg(learner_cpd_score) filter (where learner_cpd_score is not null), 2) average_learner_cpd_score,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'itemOrder', item_order,
            'testItemId', test_item_id,
            'attemptId', attempt_id,
            'status', result_status,
            'effectiveColor', effective_color,
            'effectiveScore', effective_score,
            'probeCount', probe_count,
            'itemCpd', item_cpd,
            'learnerCpdScore', learner_cpd_score,
            'correctedAt', corrected_at
          ) order by item_order
        ) filter (where item_order is not null),
        '[]'::jsonb
      ) items
    from records
    group by
      assignment_id, assignment_number, package_id, package_title,
      package_version_id, version_label, run_id, session_number, prompt_language,
      voice_id, target_cvr_ohm, cci_source_id, cci_name, cci_value, item_cpd,
      run_status, started_at, completed_at
  )
  select
    coalesce(
      jsonb_agg(to_jsonb(run_rows) order by completed_at desc nulls last, started_at desc),
      '[]'::jsonb
    ),
    count(*)::integer,
    round(avg(average_learner_cpd_score), 2)
  into v_runs, v_total, v_avg
  from run_rows;

  return jsonb_build_object(
    'learnerUserId', p_learner_user_id,
    'runCount', v_total,
    'averageLearnerCpdScore', v_avg,
    'runs', v_runs
  );
end;
$$;

revoke execute on function public.get_learner_standalone_test_results(uuid, uuid)
  from public, anon;
grant execute on function public.get_learner_standalone_test_results(uuid, uuid)
  to authenticated, service_role;
