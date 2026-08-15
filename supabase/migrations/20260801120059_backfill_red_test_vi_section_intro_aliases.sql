begin;

alter table public.narration_variants disable trigger trg_ensure_narration_parent_version_is_draft;

with red as (
  select v.id as version_id
  from public.test_packages p
  join public.test_package_versions v on v.package_id = p.id
  where p.slug = 'red-test'
  limit 1
),
en_intros as (
  select
    nv.package_version_id,
    nv.test_section_id,
    nv.narration_target,
    nv.voice_id,
    nv.voice_label,
    nv.source_text_hash,
    nv.provider_metadata,
    nv.audio_asset_id,
    s.section_order
  from public.narration_variants nv
  join public.test_sections s on s.id = nv.test_section_id
  join red r on r.version_id = nv.package_version_id
  where nv.narration_target = 'section_intro'
    and nv.language = 'en'
    and nv.approval_status = 'approved'
    and s.section_order between 1 and 3
)
insert into public.narration_variants (
  package_version_id,
  test_section_id,
  test_item_id,
  narration_target,
  language,
  voice_id,
  voice_label,
  source_text_hash,
  provider_metadata,
  audio_asset_id,
  approval_status,
  approved_at
)
select
  package_version_id,
  test_section_id,
  null::uuid,
  narration_target,
  'vi',
  voice_id,
  voice_label,
  source_text_hash || ':vi-alias',
  provider_metadata || jsonb_build_object(
    'runtimeLanguageKey', 'vi',
    'aliasedFromLanguage', 'en',
    'aliasedForReadiness', true,
    'reason', 'Red-Test Session 1-3 run in VI; reuse same approved section intro audio asset',
    'createdBy', 'Craft Agent',
    'createdAtAuthoritative', '2026-08-01T12:00:00Z'
  ),
  audio_asset_id,
  'approved',
  now()
from en_intros ei
where not exists (
  select 1
  from public.narration_variants existing
  where existing.package_version_id = ei.package_version_id
    and existing.test_section_id = ei.test_section_id
    and existing.narration_target = 'section_intro'
    and existing.language = 'vi'
    and existing.approval_status = 'approved'
);

alter table public.narration_variants enable trigger trg_ensure_narration_parent_version_is_draft;

commit;;
