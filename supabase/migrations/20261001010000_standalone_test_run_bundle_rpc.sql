-- Migration: Add get_standalone_test_run_bundle RPC
-- Purpose: Consolidate the ~65 HTTP request waterfall in 1-on-1 Test Run page into a single atomic database query.

create or replace function public.get_standalone_test_run_bundle(
  p_run_id uuid,
  p_assignment_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid;
  v_primary_run record;
  v_assignment record;
  v_version record;
  v_package record;
  v_assignment_id uuid;
  v_all_runs jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_package_start_id text := null;
  v_part_one_id text := null;
  v_part_two_id text := null;
  v_part_three_id text := null;
  v_package_end_id text := null;
  v_session_intros jsonb := '{}'::jsonb;
  v_rac_label text := '%c';
  v_sec record;
  v_new_run_id uuid;
  v_readiness record;
  v_item record;
  v_run_item_id uuid;
  v_attempt_id uuid;
begin
  v_actor := public.current_staff_user_id();
  if v_actor is null then
    raise exception 'Staff authentication required' using errcode = '42501';
  end if;

  -- 1. Fetch primary run
  select * into v_primary_run
  from public.standalone_test_runs
  where id = p_run_id;

  if v_primary_run.id is null then
    return jsonb_build_object('ok', false, 'error', 'Standalone Test Run not found');
  end if;

  v_assignment_id := coalesce(p_assignment_id, v_primary_run.assignment_id);

  -- 2. Fetch assignment, version, package
  select * into v_assignment
  from public.standalone_test_assignments
  where id = v_assignment_id;

  if v_assignment.id is not null then
    select * into v_version
    from public.test_package_versions
    where id = v_assignment.package_version_id;

    if v_version.id is not null then
      select * into v_package
      from public.test_packages
      where id = v_version.package_id;
    end if;
  end if;

  -- 3. Auto-prepare & start missing section runs in-database (eliminates client loop)
  if v_version.id is not null then
    for v_sec in
      select s.*
      from public.test_sections s
      where s.package_version_id = v_version.id
      order by s.section_order asc
    loop
      if not exists (
        select 1 from public.standalone_test_runs r
        where r.assignment_id = v_assignment_id and r.test_section_id = v_sec.id
      ) then
        v_new_run_id := gen_random_uuid();

        -- Snapshot measurements
        select * into v_readiness
        from public.section_measurement_snapshots
        where test_section_id = v_sec.id
        limit 1;

        insert into public.standalone_test_runs (
          id, organization_id, assignment_id, test_section_id, session_number,
          prompt_language, voice_id, status, started_at, target_cvr_ohm, cci_value, item_cpd,
          total_items, created_by_user_id
        ) values (
          v_new_run_id, v_assignment.organization_id, v_assignment_id, v_sec.id, v_sec.section_order,
          v_primary_run.prompt_language, coalesce(v_primary_run.voice_id, 'default'), 'in_progress', now(),
          coalesce(v_readiness.target_cvr_ohm, 0), coalesce(v_readiness.cci_value, 0), coalesce(v_readiness.derived_item_cpd, 0),
          coalesce(v_sec.item_count, 7), v_actor
        );

        -- Populate run items from test_items
        for v_item in
          select * from public.test_items
          where section_id = v_sec.id
          order by item_order asc
        loop
          v_run_item_id := gen_random_uuid();
          insert into public.standalone_test_run_items (
            id, run_id, test_item_id, item_order
          ) values (
            v_run_item_id, v_new_run_id, v_item.id, v_item.item_order
          );

          v_attempt_id := gen_random_uuid();
          insert into public.standalone_test_attempts (
            id, run_id, run_item_id, learner_user_id, teacher_user_id, status, started_at
          ) values (
            v_attempt_id, v_new_run_id, v_run_item_id, v_assignment.learner_user_id, v_actor, 'draft', now()
          );

          insert into public.standalone_test_attempt_snapshots (
            attempt_id, status, entered_probe_flow, probe_count, updated_at
          ) values (
            v_attempt_id, 'draft', false, 0, now()
          );
        end loop;
      end if;
    end loop;
  end if;

  -- 4. Query all sibling runs for this assignment
  select coalesce(jsonb_agg(to_jsonb(r) order by r.session_number asc), '[]'::jsonb)
  into v_all_runs
  from public.standalone_test_runs r
  where r.assignment_id = v_assignment_id;

  -- 5. Query narration audio variants (Package level)
  if v_version.id is not null then
    -- Package start
    select v.id::text into v_package_start_id
    from public.narration_variants v
    where v.package_version_id = v_version.id
      and v.narration_target = 'package_start'
      and v.approval_status = 'approved'
      and v.audio_asset_id is not null
    order by v.created_at desc limit 1;

    -- Part 1, 2, 3 intros
    select v.id::text into v_part_one_id
    from public.narration_variants v
    where v.package_version_id = v_version.id
      and v.narration_target = 'part_intro'
      and (v.metadata->>'part')::int = 1
      and v.approval_status = 'approved'
      and v.audio_asset_id is not null
    order by v.created_at desc limit 1;

    select v.id::text into v_part_two_id
    from public.narration_variants v
    where v.package_version_id = v_version.id
      and v.narration_target = 'part_intro'
      and (v.metadata->>'part')::int = 2
      and v.approval_status = 'approved'
      and v.audio_asset_id is not null
    order by v.created_at desc limit 1;

    select v.id::text into v_part_three_id
    from public.narration_variants v
    where v.package_version_id = v_version.id
      and v.narration_target = 'part_intro'
      and (v.metadata->>'part')::int = 3
      and v.approval_status = 'approved'
      and v.audio_asset_id is not null
    order by v.created_at desc limit 1;

    -- Package end
    select v.id::text into v_package_end_id
    from public.narration_variants v
    where v.package_version_id = v_version.id
      and v.narration_target = 'package_end'
      and v.approval_status = 'approved'
      and v.audio_asset_id is not null
    order by v.created_at desc limit 1;

    -- Section intros mapping (sessionNumber -> variantId)
    select jsonb_object_agg(
      r.session_number::text,
      (
        select v.id::text
        from public.narration_variants v
        where v.test_section_id = r.test_section_id
          and v.narration_target = 'section_intro'
          and v.approval_status = 'approved'
          and v.audio_asset_id is not null
        order by v.created_at desc limit 1
      )
    ) into v_session_intros
    from public.standalone_test_runs r
    where r.assignment_id = v_assignment_id;
  end if;

  -- Determine RAC label
  if v_package.title is not null and lower(v_package.title) like '%red%' then
    v_rac_label := '%r';
  end if;

  -- 6. Query all run items with joined test_items and latest snapshot
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ri.id,
        'run_id', ri.run_id,
        'test_item_id', ri.test_item_id,
        'item_order', ri.item_order,
        'parent_run_id', r.id,
        'session_number', r.session_number,
        'prompt_language', r.prompt_language,
        'voice_id', r.voice_id,
        'test_section_id', r.test_section_id,
        'prompt_vi', ti.prompt_vi,
        'prompt_en', ti.prompt_en,
        'spoken_script_vi', ti.spoken_script_vi,
        'spoken_script_en', ti.spoken_script_en,
        'tc', ti.tc,
        'tl', ti.tl,
        'lc', ti.lc,
        'cvr', r.target_cvr_ohm,
        'cci', r.cci_value,
        'cpd', r.item_cpd,
        'attempt_id', att.id,
        'attempt_status', coalesce(snp.status::text, 'draft'),
        'effective_color', snp.effective_color,
        'entered_probe_flow', coalesce(snp.entered_probe_flow, false),
        'probe_count', coalesce(snp.probe_count, 0),
        'finalized_at', snp.finalized_at
      )
      order by r.session_number asc, ri.item_order asc
    ),
    '[]'::jsonb
  ) into v_items
  from public.standalone_test_runs r
  join public.standalone_test_run_items ri on ri.run_id = r.id
  join public.test_items ti on ti.id = ri.test_item_id
  left join public.standalone_test_attempts att on att.run_item_id = ri.id
  left join public.standalone_test_attempt_snapshots snp on snp.attempt_id = att.id
  where r.assignment_id = v_assignment_id;

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'runDetails', to_jsonb(v_primary_run),
      'allRuns', v_all_runs,
      'packageTitle', coalesce(v_package.title, 'Standalone Test'),
      'packageKind', case when lower(coalesce(v_package.title, '')) like '%mini%' then 'mini' else 'standard' end,
      'racMetricLabel', v_rac_label,
      'packageAudio', jsonb_build_object(
        'packageStartVariantId', v_package_start_id,
        'partIntroVariantIds', jsonb_build_object('1', v_part_one_id, '2', v_part_two_id, '3', v_part_three_id),
        'packageEndVariantId', v_package_end_id
      ),
      'sessionIntroVariantIds', coalesce(v_session_intros, '{}'::jsonb),
      'items', v_items
    )
  );
end;
$$;

revoke all on function public.get_standalone_test_run_bundle(uuid, uuid) from public, anon;
grant execute on function public.get_standalone_test_run_bundle(uuid, uuid) to authenticated;
