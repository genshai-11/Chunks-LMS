-- Live Test V2 Generation and TTS server seams.
-- Real 9Router LLM/TTS requests are performed by the `live-test-generation`
-- Supabase Edge Function. The database RPCs below keep only an explicit
-- local/CI deterministic adapter for pgTAP/local development and must not be
-- used as the production generation path.

SET search_path TO public, extensions;

-- The Edge Function uploads to the private `narration-audio` Storage bucket.
-- Bucket provisioning/remote verification remains a release-control concern for
-- the later #11 hardening ticket; this recovery performs no remote Storage action.

-- ---------------------------------------------------------------------------
-- Staging and Job Helpers
-- ---------------------------------------------------------------------------

create or replace function public.live_test_v2_current_user_id()
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return coalesce(
    (select id from public.users where auth_user_id = auth.uid()),
    '00000000-0000-0000-0000-000000000000'::uuid
  );
end;
$$;

create or replace function public.live_test_generation_mock_mode_enabled()
returns boolean
language sql
stable
as $$
  select lower(coalesce(current_setting('app.live_test_generation_mode', true), '')) = 'mock';
$$;

-- ---------------------------------------------------------------------------
-- 1. Deprecated generate_test_item RPC (explicit local/CI mock only)
-- ---------------------------------------------------------------------------

create or replace function public.generate_test_item(
  p_package_version_id uuid,
  p_test_section_id uuid,
  p_prompt_details text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_job_id uuid;
  v_actor uuid;
  v_org_id uuid;
  v_prompt_hash text;
  v_item_id uuid;
  v_now timestamptz := now();
begin
  if not public.live_test_generation_mock_mode_enabled() then
    raise exception 'Generation requires the live-test-generation Edge Function; database deterministic mocks require app.live_test_generation_mode=mock.';
  end if;

  if not public.current_staff_is_admin() then
    raise exception 'Access Denied: Only Admin staff can request Test Item generation.';
  end if;

  v_actor := public.live_test_v2_current_user_id();

  select package.organization_id into v_org_id
  from public.test_package_versions v
  join public.test_packages package on package.id = v.package_id
  where v.id = p_package_version_id;

  if v_org_id is null then
    raise exception 'Invalid package_version_id: Package version does not exist.';
  end if;

  if not exists (
    select 1 from public.test_sections
    where id = p_test_section_id and package_version_id = p_package_version_id
  ) then
    raise exception 'Invalid test_section_id: Section does not belong to the package version.';
  end if;

  if not exists (
    select 1 from public.test_package_versions
    where id = p_package_version_id and status = 'draft'
  ) then
    raise exception 'Conflict: Package version is not a draft and cannot be modified.';
  end if;

  v_prompt_hash := 'sha256:' || encode(digest(coalesce(p_prompt_details, ''), 'sha256'), 'hex');
  v_item_id := public.live_test_v2_deterministic_uuid('mock-generated-item:' || p_package_version_id::text || ':' || p_test_section_id::text || ':' || v_prompt_hash);

  insert into public.generation_jobs (
    organization_id,
    requested_by_user_id,
    package_version_id,
    test_section_id,
    job_type,
    status,
    prompt_hash,
    started_at,
    completed_at,
    attempts,
    provider_metadata,
    updated_at
  )
  values (
    v_org_id,
    v_actor,
    p_package_version_id,
    p_test_section_id,
    'test_item',
    'succeeded',
    v_prompt_hash,
    v_now,
    v_now,
    jsonb_build_array(jsonb_build_object('attempt', 1, 'status', 'succeeded', 'provider', 'local-deterministic-mock')),
    jsonb_build_object(
      'provider', 'local-deterministic-mock',
      'mode', 'mock',
      'generated_item', jsonb_build_object(
        'id', v_item_id,
        'prompt_vi', '[Mock] Câu hỏi mẫu tiếng Việt từ ' || p_prompt_details,
        'prompt_en', '[Mock] Sample English prompt from ' || p_prompt_details,
        'tc', 3,
        'lc', 1,
        'tl', 1,
        'measured_cvr', 3
      )
    ),
    v_now
  )
  returning id into v_job_id;

  return jsonb_build_object(
    'jobId', v_job_id,
    'status', 'succeeded',
    'requestedAt', v_now,
    'completedAt', v_now,
    'itemPreview', jsonb_build_object(
      'promptVi', '[Mock] Câu hỏi mẫu tiếng Việt từ ' || p_prompt_details,
      'promptEn', '[Mock] Sample English prompt from ' || p_prompt_details
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Deprecated generate_narration RPC (explicit local/CI mock only)
-- ---------------------------------------------------------------------------

create or replace function public.generate_narration(
  p_package_version_id uuid,
  p_target text,
  p_test_section_id uuid,
  p_test_item_id uuid,
  p_language text,
  p_voice_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_job_id uuid;
  v_actor uuid;
  v_org_id uuid;
  v_text_to_speak text;
  v_source_hash text;
  v_audio_id uuid;
  v_variant_id uuid;
  v_now timestamptz := now();
  v_storage_path text;
begin
  if not public.live_test_generation_mock_mode_enabled() then
    raise exception 'Generation requires the live-test-generation Edge Function; database deterministic mocks require app.live_test_generation_mode=mock.';
  end if;

  if not public.current_staff_is_admin() then
    raise exception 'Access Denied: Only Admin staff can request narration generation.';
  end if;

  v_actor := public.live_test_v2_current_user_id();

  if p_target not in ('section_intro', 'test_item') then
    raise exception 'Invalid parameter: p_target must be section_intro or test_item.';
  end if;

  if p_target = 'section_intro' and (p_test_section_id is null or p_test_item_id is not null) then
    raise exception 'Invalid parameters for section_intro target.';
  end if;

  if p_target = 'test_item' and (p_test_item_id is null or p_test_section_id is not null) then
    raise exception 'Invalid parameters for test_item target.';
  end if;

  select package.organization_id into v_org_id
  from public.test_package_versions v
  join public.test_packages package on package.id = v.package_id
  where v.id = p_package_version_id;

  if v_org_id is null then
    raise exception 'Invalid package_version_id: Package version does not exist.';
  end if;

  if not exists (select 1 from public.test_package_versions where id = p_package_version_id and status = 'draft') then
    raise exception 'Conflict: Package version is not a draft and cannot be modified.';
  end if;

  if p_target = 'section_intro' then
    select title into v_text_to_speak
    from public.test_sections
    where id = p_test_section_id and package_version_id = p_package_version_id;
  else
    select case when p_language = 'vi' then prompt_vi else prompt_en end into v_text_to_speak
    from public.test_items
    where id = p_test_item_id and package_version_id = p_package_version_id;
  end if;

  if v_text_to_speak is null then
    raise exception 'Invalid section or item ID: Text to speak not found.';
  end if;

  v_source_hash := 'sha256:' || encode(digest(v_text_to_speak || ':' || p_language || ':' || p_voice_id, 'sha256'), 'hex');
  v_audio_id := public.live_test_v2_deterministic_uuid('mock-generated-audio:' || p_package_version_id::text || ':' || v_source_hash);
  v_variant_id := public.live_test_v2_deterministic_uuid('mock-generated-variant:' || p_package_version_id::text || ':' || v_source_hash);

  insert into public.generation_jobs (
    organization_id,
    requested_by_user_id,
    package_version_id,
    test_section_id,
    test_item_id,
    job_type,
    status,
    source_hash,
    started_at,
    updated_at
  )
  values (
    v_org_id,
    v_actor,
    p_package_version_id,
    p_test_section_id,
    p_test_item_id,
    case when p_target = 'section_intro' then 'section_intro_narration'::text else 'item_narration'::text end,
    'running',
    v_source_hash,
    v_now,
    v_now
  )
  returning id into v_job_id;

  v_storage_path := 'narrations/mock/' || v_job_id::text || '.mp3';

  insert into public.audio_assets (
    id,
    organization_id,
    storage_bucket,
    storage_path,
    mime_type,
    sha256,
    visibility,
    source_kind,
    bytes,
    metadata
  )
  values (
    v_audio_id,
    v_org_id,
    'narration-audio',
    v_storage_path,
    'audio/mpeg',
    'sha256:' || encode(digest('mock-audio:' || v_source_hash, 'sha256'), 'hex'),
    'private',
    'generated_tts',
    length('mock-audio:' || v_source_hash),
    jsonb_build_object('provider', 'local-deterministic-mock', 'mode', 'mock')
  );

  insert into public.narration_variants (
    id,
    package_version_id,
    test_section_id,
    test_item_id,
    narration_target,
    language,
    voice_id,
    voice_label,
    source_text_hash,
    audio_asset_id,
    approval_status,
    generation_job_id,
    provider_metadata
  )
  values (
    v_variant_id,
    p_package_version_id,
    p_test_section_id,
    p_test_item_id,
    p_target,
    p_language,
    p_voice_id,
    '[Mock] ' || p_voice_id,
    v_source_hash,
    v_audio_id,
    'generated',
    v_job_id,
    jsonb_build_object('provider', 'local-deterministic-mock', 'mode', 'mock')
  );

  update public.generation_jobs
  set status = 'succeeded',
      completed_at = v_now,
      narration_variant_id = v_variant_id,
      attempts = jsonb_build_array(jsonb_build_object('attempt', 1, 'status', 'succeeded', 'provider', 'local-deterministic-mock')),
      provider_metadata = jsonb_build_object(
        'provider', 'local-deterministic-mock',
        'mode', 'mock',
        'audio_asset_id', v_audio_id,
        'narration_variant_id', v_variant_id,
        'storage_bucket', 'narration-audio',
        'storage_path', v_storage_path
      )
  where id = v_job_id;

  return jsonb_build_object(
    'jobId', v_job_id,
    'status', 'succeeded',
    'requestedAt', v_now,
    'completedAt', v_now,
    'narrationVariantId', v_variant_id,
    'audioPath', v_storage_path
  );
exception when others then
  if v_job_id is not null then
    update public.generation_jobs
    set status = 'failed',
        completed_at = now(),
        error_code = sqlstate,
        error_message = sqlerrm,
        attempts = coalesce(attempts, '[]'::jsonb) || jsonb_build_object(
          'attempt', jsonb_array_length(coalesce(attempts, '[]'::jsonb)) + 1,
          'status', 'failed',
          'errorCode', sqlstate,
          'errorMessage', sqlerrm
        )
    where id = v_job_id;
  end if;
  raise;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. approve_generated_asset RPC (Human approval requirement)
-- ---------------------------------------------------------------------------

create or replace function public.approve_generated_asset(
  p_generation_job_id uuid,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid;
  v_variant_id uuid;
  v_status text;
  v_now timestamptz := now();
begin
  if not public.current_staff_is_admin() then
    raise exception 'Access Denied: Only Admin staff can approve generated narration variants.';
  end if;

  v_actor := public.live_test_v2_current_user_id();

  select id, approval_status into v_variant_id, v_status
  from public.narration_variants
  where generation_job_id = p_generation_job_id;

  if v_variant_id is null then
    raise exception 'Invalid parameter: Narration variant not found for this generation job.';
  end if;

  if v_status = 'approved' then
    return jsonb_build_object(
      'narrationVariantId', v_variant_id,
      'approved', true,
      'message', 'Asset is already approved.'
    );
  end if;

  update public.narration_variants
  set approval_status = 'approved',
      approved_by_user_id = v_actor,
      approved_at = v_now,
      provider_metadata = provider_metadata || jsonb_build_object('approval_notes', p_notes),
      updated_at = v_now
  where id = v_variant_id;

  update public.generation_jobs
  set provider_metadata = provider_metadata || jsonb_build_object('approved_at', v_now, 'approved_by', v_actor)
  where id = p_generation_job_id;

  return jsonb_build_object(
    'narrationVariantId', v_variant_id,
    'approved', true,
    'approvedAt', v_now,
    'approvedByUserId', v_actor
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant execute on function public.generate_test_item(uuid, uuid, text) to authenticated;
grant execute on function public.generate_narration(uuid, text, uuid, uuid, text, text) to authenticated;
grant execute on function public.approve_generated_asset(uuid, text) to authenticated;
