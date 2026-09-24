-- Migration: Add edit_test_item_text RPC for editing test item prompts and scripts
-- Supports editing both draft and published package versions with proper text repair audit

CREATE OR REPLACE FUNCTION public.edit_test_item_text(
  p_item_id uuid,
  p_prompt_vi text,
  p_prompt_en text,
  p_term_vi text DEFAULT null,
  p_term_en text DEFAULT null,
  p_spoken_script_vi text DEFAULT null,
  p_spoken_script_en text DEFAULT null,
  p_tc numeric DEFAULT null,
  p_tl numeric DEFAULT null,
  p_lc numeric DEFAULT null,
  p_measured_cvr numeric DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_item record;
  v_version_id uuid;
  v_status text;
  v_repair_id uuid := gen_random_uuid();
  v_org_id uuid;
  v_original_published_at timestamptz;
BEGIN
  -- 1. Verify caller has staff permissions
  IF NOT (public.current_staff_is_admin() OR public.current_staff_is_teacher()) THEN
    RAISE EXCEPTION 'Access denied: staff privileges required';
  END IF;

  -- 2. Fetch item and parent version
  SELECT i.*, p.organization_id, v.published_at INTO v_item
  FROM public.test_items i
  JOIN public.test_package_versions v ON v.id = i.package_version_id
  JOIN public.test_packages p ON p.id = v.package_id
  WHERE i.id = p_item_id;

  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'Test item % not found', p_item_id;
  END IF;

  v_version_id := v_item.package_version_id;
  v_org_id := v_item.organization_id;
  v_original_published_at := v_item.published_at;
  SELECT status INTO v_status FROM public.test_package_versions WHERE id = v_version_id;

  -- 3. If version is published, use package_version_text_repairs audit log flow
  IF v_status = 'published' THEN
    INSERT INTO public.package_version_text_repairs(
      id, organization_id, package_version_id, reason, status, requested_by_user_id
    ) VALUES (
      v_repair_id, v_org_id, v_version_id, 'Direct item edit in Package Studio', 'running', public.current_staff_user_id()
    );

    PERFORM set_config('app.package_text_repair_id', v_repair_id::text, true);

    UPDATE public.test_package_versions
    SET status = 'draft', published_at = null
    WHERE id = v_version_id;

    UPDATE public.test_items
    SET
      prompt_vi = COALESCE(p_prompt_vi, prompt_vi),
      prompt_en = COALESCE(p_prompt_en, prompt_en),
      term_vi = COALESCE(p_term_vi, term_vi),
      term_en = COALESCE(p_term_en, term_en),
      spoken_script_vi = COALESCE(p_spoken_script_vi, spoken_script_vi),
      spoken_script_en = COALESCE(p_spoken_script_en, spoken_script_en),
      tc = COALESCE(p_tc, tc),
      tl = COALESCE(p_tl, tl),
      lc = COALESCE(p_lc, lc),
      measured_cvr = COALESCE(p_measured_cvr, measured_cvr),
      updated_at = now()
    WHERE id = p_item_id;

    UPDATE public.test_package_versions
    SET status = 'published', published_at = COALESCE(v_original_published_at, now())
    WHERE id = v_version_id;

    UPDATE public.package_version_text_repairs
    SET status = 'completed', completed_at = now()
    WHERE id = v_repair_id;

    PERFORM set_config('app.package_text_repair_id', '', true);
  ELSE
    -- If draft, directly update
    UPDATE public.test_items
    SET
      prompt_vi = COALESCE(p_prompt_vi, prompt_vi),
      prompt_en = COALESCE(p_prompt_en, prompt_en),
      term_vi = COALESCE(p_term_vi, term_vi),
      term_en = COALESCE(p_term_en, term_en),
      spoken_script_vi = COALESCE(p_spoken_script_vi, spoken_script_vi),
      spoken_script_en = COALESCE(p_spoken_script_en, spoken_script_en),
      tc = COALESCE(p_tc, tc),
      tl = COALESCE(p_tl, tl),
      lc = COALESCE(p_lc, lc),
      measured_cvr = COALESCE(p_measured_cvr, measured_cvr),
      updated_at = now()
    WHERE id = p_item_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'itemId', p_item_id,
    'promptVi', COALESCE(p_prompt_vi, v_item.prompt_vi),
    'promptEn', COALESCE(p_prompt_en, v_item.prompt_en)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.edit_test_item_text TO authenticated, anon;
