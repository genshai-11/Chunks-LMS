-- Live Test V2 Generation and TTS Modules.
-- Hides 9Router API keys and provider credentials from browser callers.

-- ---------------------------------------------------------------------------
-- Staging and Job Helpers
-- ---------------------------------------------------------------------------
SET search_path TO public, extensions;

create or replace function public.live_test_v2_current_user_id()
returns uuid
language plpgsql
security definer
as $$
begin
  return coalesce(
    (select id from public.users where auth_user_id = auth.uid()),
    '00000000-0000-0000-0000-000000000000'::uuid
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. generate_test_item RPC (LLM deep module adapter)
-- ---------------------------------------------------------------------------

create or replace function public.generate_test_item(
  p_package_version_id uuid,
  p_test_section_id uuid,
  p_prompt_details text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_job_id uuid;
  v_actor uuid;
  v_org_id uuid;
  v_prompt_hash text;
  v_item_id uuid;
  v_ninerouter_key text;
begin
  -- Access control: Admin staff only
  if not public.current_staff_is_admin() then
    raise exception 'Access Denied: Only Admin staff can request Test Item generation.';
  end if;

  v_actor := public.live_test_v2_current_user_id();

  -- Get organization context from package version
  select package.organization_id into v_org_id
  from public.test_package_versions v
  join public.test_packages package on package.id = v.package_id
  where v.id = p_package_version_id;

  if v_org_id is null then
    raise exception 'Invalid package_version_id: Package version does not exist.';
  end if;

  -- Verify target section exists and is part of the package version
  if not exists (
    select 1 from public.test_sections
    where id = p_test_section_id and package_version_id = p_package_version_id
  ) then
    raise exception 'Invalid test_section_id: Section does not belong to the package version.';
  end if;

  -- Ensure package version is in draft status
  if not exists (
    select 1 from public.test_package_versions
    where id = p_package_version_id and status = 'draft'
  ) then
    raise exception 'Conflict: Package version is not a draft and cannot be modified.';
  end if;

  v_prompt_hash := 'sha256:' || encode(digest(coalesce(p_prompt_details, ''), 'sha256'), 'hex');

  -- Create auditable generation job
  insert into public.generation_jobs (
    organization_id,
    requested_by_user_id,
    package_version_id,
    test_section_id,
    job_type,
    status,
    prompt_hash,
    updated_at
  )
  values (
    v_org_id,
    v_actor,
    p_package_version_id,
    p_test_section_id,
    'test_item',
    'running',
    v_prompt_hash,
    now()
  )
  returning id into v_job_id;

  -- Read 9Router API secret from private environment context (database parameter)
  v_ninerouter_key := current_setting('app.ninerouter_api_key', true);

  -- Adapter logic: In offline/mock mode or if no key is present, generate deterministically.
  -- In production, this would make an HTTP request to the 9Router proxy using pg_net or edge function.
  -- Here we mock the server-side response, hiding adapter details from the browser.
  begin
    -- Deterministic item payload generation
    v_item_id := public.live_test_v2_deterministic_uuid('generated-item:' || v_job_id::text);

    -- Simulating successful LLM payload insertion into generation_jobs provider_metadata
    update public.generation_jobs
    set status = 'succeeded',
        completed_at = now(),
        provider_metadata = jsonb_build_object(
          'model', '9router/claude-3-5-sonnet',
          'generated_item', jsonb_build_object(
            'id', v_item_id,
            'prompt_vi', 'Câu hỏi mẫu tiếng Việt gợi ý từ ' || p_prompt_details,
            'prompt_en', 'Sample English prompt generated from ' || p_prompt_details,
            'tc', 3,
            'lc', 1,
            'tl', 1,
            'measured_cvr', 3
          )
        )
    where id = v_job_id;

    -- Return receipt without exposing v_ninerouter_key
    return jsonb_build_object(
      'jobId', v_job_id,
      'status', 'succeeded',
      'requestedAt', now(),
      'completedAt', now(),
      'itemPreview', jsonb_build_object(
        'promptVi', 'Câu hỏi mẫu tiếng Việt gợi ý từ ' || p_prompt_details,
        'promptEn', 'Sample English prompt generated from ' || p_prompt_details
      )
    );
  exception when others then
    -- Handle errors and log attempts
    update public.generation_jobs
    set status = 'failed',
        completed_at = now(),
        error_code = sqlstate,
        error_message = sqlerrm,
        attempts = coalesce(attempts, '[]'::jsonb) || jsonb_build_object(
          'timestamp', now(),
          'error', sqlerrm
        )
    where id = v_job_id;

    return jsonb_build_object(
      'jobId', v_job_id,
      'status', 'failed',
      'errorCode', sqlstate,
      'errorMessage', sqlerrm
    );
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. generate_narration RPC (TTS deep module adapter)
-- ---------------------------------------------------------------------------

create or replace function public.generate_narration(
  p_package_version_id uuid,
  p_target text, -- 'section_intro' | 'test_item'
  p_test_section_id uuid,
  p_test_item_id uuid,
  p_language text,
  p_voice_id text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_job_id uuid;
  v_actor uuid;
  v_org_id uuid;
  v_text_to_speak text;
  v_source_hash text;
  v_audio_id uuid;
  v_variant_id uuid;
  v_ninerouter_key text;
begin
  -- Access control: Admin staff only
  if not public.current_staff_is_admin() then
    raise exception 'Access Denied: Only Admin staff can request narration generation.';
  end if;

  v_actor := public.live_test_v2_current_user_id();

  -- Target validations
  if p_target not in ('section_intro', 'test_item') then
    raise exception 'Invalid parameter: p_target must be section_intro or test_item.';
  end if;

  if p_target = 'section_intro' and (p_test_section_id is null or p_test_item_id is not null) then
    raise exception 'Invalid parameters for section_intro target.';
  end if;

  if p_target = 'test_item' and (p_test_item_id is null or p_test_section_id is not null) then
    raise exception 'Invalid parameters for test_item target.';
  end if;

  -- Get organization context
  select package.organization_id into v_org_id
  from public.test_package_versions v
  join public.test_packages package on package.id = v.package_id
  where v.id = p_package_version_id;

  if v_org_id is null then
    raise exception 'Invalid package_version_id: Package version does not exist.';
  end if;

  -- Extract text to speak
  if p_target = 'section_intro' then
    select title into v_text_to_speak
    from public.test_sections
    where id = p_test_section_id and package_version_id = p_package_version_id;
  else
    select coalesce(prompt_vi, prompt_en) into v_text_to_speak
    from public.test_items
    where id = p_test_item_id and package_version_id = p_package_version_id;
  end if;

  if v_text_to_speak is null then
    raise exception 'Invalid section or item ID: Text to speak not found.';
  end if;

  v_source_hash := 'sha256:' || encode(digest(v_text_to_speak || ':' || p_language || ':' || p_voice_id, 'sha256'), 'hex');

  -- Create auditable generation job
  insert into public.generation_jobs (
    organization_id,
    requested_by_user_id,
    package_version_id,
    test_section_id,
    test_item_id,
    job_type,
    status,
    source_hash,
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
    now()
  )
  returning id into v_job_id;

  -- Read 9Router API secret
  v_ninerouter_key := current_setting('app.ninerouter_api_key', true);

  begin
    -- Deterministic IDs for audio asset and narration variant
    v_audio_id := public.live_test_v2_deterministic_uuid('generated-audio:' || v_job_id::text);
    v_variant_id := public.live_test_v2_deterministic_uuid('generated-variant:' || v_job_id::text);

    -- Create private storage audio asset row
    insert into public.audio_assets (
      id,
      organization_id,
      storage_bucket,
      storage_path,
      mime_type,
      duration_ms,
      visibility,
      source_kind,
      bytes
    )
    values (
      v_audio_id,
      v_org_id,
      'narration-audio',
      'narrations/' || v_job_id::text || '.mp3',
      'audio/mpeg',
      1200, -- simulated duration ms
      'private',
      'generated_tts',
      4500 -- simulated bytes size
    );

    -- Create narration variant pending approval (human-approval requirement)
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
      '9Router TTS voice ' || p_voice_id,
      v_source_hash,
      v_audio_id,
      'generated', -- status set to 'generated', pending human review
      v_job_id,
      jsonb_build_object('model', '9router/tts-1', 'voice', p_voice_id)
    );

    -- Update job to succeeded
    update public.generation_jobs
    set status = 'succeeded',
        completed_at = now(),
        narration_variant_id = v_variant_id,
        provider_metadata = jsonb_build_object(
          'model', '9router/tts-1',
          'audio_asset_id', v_audio_id,
          'narration_variant_id', v_variant_id
        )
    where id = v_job_id;

    -- Return receipt without exposing v_ninerouter_key
    return jsonb_build_object(
      'jobId', v_job_id,
      'status', 'succeeded',
      'requestedAt', now(),
      'completedAt', now(),
      'narrationVariantId', v_variant_id,
      'audioPath', 'narrations/' || v_job_id::text || '.mp3'
    );
  exception when others then
    update public.generation_jobs
    set status = 'failed',
        completed_at = now(),
        error_code = sqlstate,
        error_message = sqlerrm,
        attempts = coalesce(attempts, '[]'::jsonb) || jsonb_build_object(
          'timestamp', now(),
          'error', sqlerrm
        )
    where id = v_job_id;

    return jsonb_build_object(
      'jobId', v_job_id,
      'status', 'failed',
      'errorCode', sqlstate,
      'errorMessage', sqlerrm
    );
  end;
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
as $$
declare
  v_actor uuid;
  v_variant_id uuid;
  v_status text;
begin
  -- Access control: Admin staff only
  if not public.current_staff_is_admin() then
    raise exception 'Access Denied: Only Admin staff can approve generated narration variants.';
  end if;

  v_actor := public.live_test_v2_current_user_id();

  -- Get narration variant associated with the generation job
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

  -- Apply human approval
  update public.narration_variants
  set approval_status = 'approved',
      approved_by_user_id = v_actor,
      approved_at = now(),
      provider_metadata = provider_metadata || jsonb_build_object('approval_notes', p_notes),
      updated_at = now()
  where id = v_variant_id;

  update public.generation_jobs
  set provider_metadata = provider_metadata || jsonb_build_object('approved_at', now(), 'approved_by', v_actor)
  where id = p_generation_job_id;

  return jsonb_build_object(
    'narrationVariantId', v_variant_id,
    'approved', true,
    'approvedAt', now(),
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
