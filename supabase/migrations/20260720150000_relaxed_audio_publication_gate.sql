-- Relax publication readiness gate: require all 8 sessions to be ready in EITHER Vietnamese OR English, not both.

create or replace function public.get_test_package_publication_readiness(
  p_package_version_id uuid,
  p_voice_vi text,
  p_voice_en text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v public.test_package_versions%rowtype;
  v_sections integer;
  v_items integer;
  v_ready_vi integer;
  v_ready_en integer;
  v_ready_either integer;
begin
  if not public.current_staff_is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if nullif(trim(p_voice_vi), '') is null or nullif(trim(p_voice_en), '') is null then
    raise exception 'Vietnamese and English TTS model IDs are required';
  end if;
  select * into v from public.test_package_versions where id = p_package_version_id;
  if v.id is null then raise exception 'Package Version not found'; end if;

  select count(*) into v_sections from public.test_sections where package_version_id = v.id;
  select count(*) into v_items from public.test_items where package_version_id = v.id;
  
  select count(*) into v_ready_vi
  from public.test_sections s
  where s.package_version_id = v.id
    and private.section_audio_bundle_ready(s.id, 'vi', p_voice_vi);
    
  select count(*) into v_ready_en
  from public.test_sections s
  where s.package_version_id = v.id
    and private.section_audio_bundle_ready(s.id, 'en', p_voice_en);

  select count(*) into v_ready_either
  from public.test_sections s
  where s.package_version_id = v.id
    and (
      private.section_audio_bundle_ready(s.id, 'vi', p_voice_vi)
      or private.section_audio_bundle_ready(s.id, 'en', p_voice_en)
    );

  return jsonb_build_object(
    'packageVersionId', v.id,
    'status', v.status,
    'sectionCount', v_sections,
    'itemCount', v_items,
    'voiceVi', p_voice_vi,
    'voiceEn', p_voice_en,
    'readyVietnameseSections', v_ready_vi,
    'readyEnglishSections', v_ready_en,
    'readyEitherSections', v_ready_either,
    'canPublish', v.status = 'draft'
      and v_sections = 8
      and v_items = 80
      and v_ready_either = 8
  );
end
$$;
