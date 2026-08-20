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
-- Relax standalone assignment: allow assignments for draft package versions (essential for live-test simulation runs before publication)

create or replace function public.create_standalone_test_assignment(p_learner_user_id uuid, p_package_version_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_actor uuid; v_org uuid; v_number int; v_id uuid;
begin
  v_actor:=public.current_staff_user_id();
  select om.organization_id into v_org from public.organization_memberships om
  where om.user_id=p_learner_user_id and om.role='learner' limit 1;
  if v_actor is null or v_org is null or not private.staff_can_manage_standalone_test(v_org,p_learner_user_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  -- Relaxed: Allow both draft and published package versions for assignment (essential for standalone simulation runs)
  if not exists(select 1 from public.test_package_versions where id=p_package_version_id and status in ('draft', 'published')) then raise exception 'Valid Package Version required'; end if;
  select coalesce(max(assignment_number),0)+1 into v_number from public.standalone_test_assignments where learner_user_id=p_learner_user_id and package_version_id=p_package_version_id;
  insert into public.standalone_test_assignments(organization_id,learner_user_id,package_version_id,assigned_by_user_id,assignment_number)
  values(v_org,p_learner_user_id,p_package_version_id,v_actor,v_number) returning id into v_id;
  return v_id;
end $$;
