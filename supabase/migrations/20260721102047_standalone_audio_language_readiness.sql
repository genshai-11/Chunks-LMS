-- Standalone Tests 1-1 audio readiness is language-level, not voice/model-level.
-- Keep p_voice_id/standalone_test_runs.voice_id as the requested generation/playback model metadata,
-- but do not require approved narration variants to match that model when preparing/starting a run.

create or replace function public.prepare_standalone_test_run(
  p_assignment_id uuid,
  p_test_section_id uuid,
  p_language text,
  p_voice_id text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,extensions
as $$
declare
  a public.standalone_test_assignments%rowtype;
  s public.test_sections%rowtype;
  m public.section_measurement_snapshots%rowtype;
  c public.cci_categories%rowtype;
  v_run uuid;
  v_intro uuid;
  v_item_count int;
  v_audio_count int;
  v_hash text;
begin
  if p_language not in ('vi','en') then
    raise exception 'Language is required and must be vi or en';
  end if;
  if nullif(trim(p_voice_id),'') is null then
    raise exception 'Voice/model is required for generation metadata';
  end if;

  select * into a
  from public.standalone_test_assignments
  where id=p_assignment_id and status='active';

  if a.id is null or not private.staff_can_manage_standalone_test(a.organization_id,a.learner_user_id) then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  select * into s
  from public.test_sections
  where id=p_test_section_id and package_version_id=a.package_version_id;

  if s.id is null then
    raise exception 'Section does not belong to assignment Package Version';
  end if;

  select * into m
  from public.section_measurement_snapshots
  where test_section_id=s.id
  order by created_at desc
  limit 1;

  if m.id is null then
    raise exception 'Section measurement snapshot is required';
  end if;

  select * into c from public.cci_categories where id=m.cci_category_id;

  select id into v_intro
  from public.narration_variants
  where test_section_id=s.id
    and narration_target='section_intro'
    and language=p_language
    and approval_status='approved'
    and audio_asset_id is not null
  order by approved_at desc nulls last, created_at desc
  limit 1;

  select count(*) into v_item_count
  from public.test_items
  where section_id=s.id;

  select count(distinct i.id) into v_audio_count
  from public.test_items i
  join public.narration_variants n
    on n.test_item_id=i.id
   and n.narration_target='test_item'
   and n.language=p_language
   and n.approval_status='approved'
   and n.audio_asset_id is not null
  where i.section_id=s.id;

  v_hash:=encode(
    extensions.digest(
      concat_ws('|',a.package_version_id,s.id,m.id,p_language,coalesce(v_intro::text,''),v_audio_count::text),
      'sha256'
    ),
    'hex'
  );

  select id into v_run
  from public.standalone_test_runs
  where assignment_id=a.id
    and test_section_id=s.id
    and status in ('draft','ready')
  order by created_at desc
  limit 1;

  if v_run is null then
    insert into public.standalone_test_runs(
      organization_id,
      assignment_id,
      learner_user_id,
      test_section_id,
      section_measurement_snapshot_id,
      attempt_number,
      prompt_language,
      voice_id,
      intro_narration_variant_id,
      session_number,
      target_cvr_ohm,
      cci_source_id,
      cci_name,
      cci_value,
      readiness_hash,
      status,
      created_by_user_id
    )
    values(
      a.organization_id,
      a.id,
      a.learner_user_id,
      s.id,
      m.id,
      coalesce((select max(attempt_number)+1 from public.standalone_test_runs where assignment_id=a.id and test_section_id=s.id),1),
      p_language,
      p_voice_id,
      v_intro,
      s.section_order,
      m.target_cvr_ohm,
      coalesce(c.metadata->>'sourceCciId',m.snapshot_metadata->>'sourceCciId','unknown'),
      m.cci_category_label,
      m.cci_value,
      v_hash,
      case when v_intro is not null and v_item_count=10 and v_audio_count=10 then 'ready' else 'draft' end,
      public.current_staff_user_id()
    )
    returning id into v_run;
  else
    update public.standalone_test_runs
    set prompt_language=p_language,
        voice_id=p_voice_id,
        intro_narration_variant_id=v_intro,
        readiness_hash=v_hash,
        status=case when v_intro is not null and v_item_count=10 and v_audio_count=10 then 'ready' else 'draft' end
    where id=v_run;
  end if;

  return jsonb_build_object(
    'runId',v_run,
    'canStart',v_intro is not null and v_item_count=10 and v_audio_count=10,
    'readinessToken',v_hash,
    'introApproved',v_intro is not null,
    'itemCount',v_item_count,
    'approvedItemAudioCount',v_audio_count,
    'sessionNumber',s.section_order,
    'targetCvrOhm',m.target_cvr_ohm,
    'cciName',m.cci_category_label,
    'cciValue',m.cci_value,
    'itemCpd',m.target_cvr_ohm*m.cci_value
  );
end;
$$;

create or replace function public.start_standalone_test_run(p_run_id uuid,p_readiness_token text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,extensions
as $$
declare
  r public.standalone_test_runs%rowtype;
  v_inserted int;
begin
  select * into r
  from public.standalone_test_runs
  where id=p_run_id
  for update;

  if r.id is null or not private.staff_can_manage_standalone_test(r.organization_id,r.learner_user_id) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if r.status<>'ready' or r.readiness_hash<>p_readiness_token then
    raise exception 'Run readiness changed; prepare again';
  end if;
  if r.intro_narration_variant_id is null then
    raise exception 'Approved introduction narration required';
  end if;

  insert into public.standalone_test_run_items(
    run_id,
    test_item_id,
    item_order,
    source_item_hash,
    prompt_text,
    narration_variant_id,
    audio_asset_id,
    target_cvr_ohm,
    cci_value
  )
  select
    r.id,
    i.id,
    i.item_order,
    encode(extensions.digest(concat_ws('|',i.id,i.updated_at,case when r.prompt_language='vi' then i.prompt_vi else i.prompt_en end),'sha256'),'hex'),
    case when r.prompt_language='vi' then i.prompt_vi else i.prompt_en end,
    n.id,
    n.audio_asset_id,
    r.target_cvr_ohm,
    r.cci_value
  from public.test_items i
  join lateral (
    select nv.id,nv.audio_asset_id
    from public.narration_variants nv
    where nv.test_item_id=i.id
      and nv.narration_target='test_item'
      and nv.language=r.prompt_language
      and nv.approval_status='approved'
      and nv.audio_asset_id is not null
    order by nv.approved_at desc nulls last, nv.created_at desc
    limit 1
  ) n on true
  where i.section_id=r.test_section_id
  order by i.item_order
  on conflict do nothing;

  get diagnostics v_inserted=row_count;
  if (select count(*) from public.standalone_test_run_items where run_id=r.id)<>10 then
    raise exception 'Exactly ten approved item narrations are required';
  end if;

  update public.standalone_test_runs
  set status='in_progress',started_at=coalesce(started_at,now())
  where id=r.id;

  return jsonb_build_object('runId',r.id,'status','in_progress','itemCount',10,'insertedItems',v_inserted);
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
      and p.proname in ('prepare_standalone_test_run','start_standalone_test_run')
  loop
    execute format('revoke execute on function %s from public, anon',target);
    execute format('grant execute on function %s to authenticated, service_role',target);
  end loop;
end $$;
