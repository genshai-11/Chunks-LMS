-- Update CCI catalog labels/Ampe values and add main category metadata.
-- Local/PR migration artifact: do not apply to remote production without explicit approval.
--
-- Existing CCI schema has no dedicated `category` column. The stable columns are:
-- - cci_categories.label        = unique action label inside a CCI Profile
-- - cci_categories.value        = numeric Ampe value
-- - cci_categories.description  = human description
-- - cci_categories.metadata     = structured extension data; stores mainCategory = Blow|Flow|Chunks

with canonical_cci(session_no, action_label, ampe, description, main_category, category_source) as (
  values
    (1, 'Give it a shot', 2::numeric, 'Linear 1 on 1 as Blow', 'Blow', 'description_suffix'),
    (2, 'Go with the flow', 2::numeric, 'Linear RPD-free as Flow', 'Flow', 'description_suffix'),
    (3, 'Chunks on the go', 4::numeric, 'Linear chunking act as Chunks', 'Chunks', 'description_suffix'),
    (4, 'Freeze', 4::numeric, 'Freeze your body with RPD-free or 1-on-1 sound', 'Flow', 'keyword_fallback:rpd-free'),
    (5, 'Robot', 6::numeric, 'Move your hands linearly 1-on-1 as Blow', 'Blow', 'description_suffix'),
    (6, 'Taichi', 6::numeric, 'Move your hands nonstop freely as Flow', 'Flow', 'description_suffix'),
    (7, 'Strike', 8::numeric, 'Strike a fixed n times as Chunks', 'Chunks', 'description_suffix'),
    (8, 'Nuance Work', 8::numeric, 'Imitation game while maintaining nuances', 'Chunks', 'semantic_fallback:nuance-work')
), migrated_profiles as (
  select p.id, p.organization_id
  from public.cci_profiles p
  where p.name = 'Migrated CSV CCI Profile'
), update_profiles as (
  update public.cci_profiles p
  set
    name = 'Chunks CCI Movement Profile',
    description = 'Canonical CCI movement categories with action labels, Ampe values, and Blow/Flow/Chunks main categories.'
  from migrated_profiles mp
  where p.id = mp.id
  returning p.id, p.organization_id
), updated_categories as (
  update public.cci_categories c
  set
    label = canonical.action_label,
    value = canonical.ampe,
    description = canonical.description,
    metadata = coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'lucy-cci-main-category-update-2026-07-19',
      'session', canonical.session_no,
      'actionLabel', canonical.action_label,
      'mainCategory', canonical.main_category,
      'categorySource', canonical.category_source
    )
  from update_profiles p
  join canonical_cci canonical on true
  where c.profile_id = p.id
    and c.category_order = canonical.session_no
  returning c.id, c.profile_id, c.category_order, c.label, c.value, c.description, c.metadata
), updated_legacy_blocks as (
  update public.live_test_blocks b
  set
    cci_min = canonical.ampe,
    cci_max = canonical.ampe,
    cci_avg = canonical.ampe,
    title = canonical.action_label,
    intro_text_vi = 'Session ' || canonical.session_no::text || '. CCI ' || canonical.main_category || '. Ampe ' || canonical.ampe::text || '. ' || canonical.description || '.',
    intro_text_en = 'Session ' || canonical.session_no::text || '. CCI ' || canonical.main_category || '. Ampe ' || canonical.ampe::text || '. ' || canonical.description || '.'
  from canonical_cci canonical
  where b.block_number = canonical.session_no
  returning b.id, b.block_number
), updated_legacy_items as (
  update public.live_test_items i
  set
    cci_value = canonical.ampe,
    cci_measure = 'Ampe',
    cci_unit_label = 'Ampe',
    cci_source = 'lucy-cci-main-category-update-2026-07-19',
    metadata = coalesce(i.metadata, '{}'::jsonb) || jsonb_build_object(
      'cciMainCategory', canonical.main_category,
      'cciActionLabel', canonical.action_label,
      'cciDescription', canonical.description
    )
  from public.live_test_blocks b
  join canonical_cci canonical on canonical.session_no = b.block_number
  where i.block_id = b.id
  returning i.id
), updated_sections as (
  update public.test_sections ts
  set
    title = canonical.action_label,
    cci_profile_id = category.profile_id,
    cci_category_id = category.id,
    cci_snapshot = jsonb_build_object(
      'label', canonical.main_category,
      'actionLabel', canonical.action_label,
      'value', canonical.ampe,
      'unit', 'Ampe',
      'description', canonical.description,
      'source', 'lucy-cci-main-category-update-2026-07-19'
    )
  from canonical_cci canonical
  join public.cci_categories category on category.category_order = canonical.session_no
  join update_profiles profile on profile.id = category.profile_id
  join public.test_package_versions version on version.status = 'draft'
  where ts.section_order = canonical.session_no
    and version.id = ts.package_version_id
  returning ts.id, ts.package_version_id, ts.section_order, ts.cci_profile_id, ts.cci_category_id
), latest_snapshots as (
  select distinct on (sms.test_section_id)
    sms.id,
    sms.test_section_id,
    sms.package_version_id
  from public.section_measurement_snapshots sms
  join updated_sections us on us.id = sms.test_section_id
  order by sms.test_section_id, sms.created_at desc
)
insert into public.section_measurement_snapshots (
  id,
  test_section_id,
  package_version_id,
  target_cvr_ohm,
  cci_profile_id,
  cci_category_id,
  cci_category_label,
  cci_value,
  snapshot_metadata,
  supersedes_snapshot_id,
  override_reason,
  created_by_user_id
)
select
  public.live_test_v2_deterministic_uuid('section-measurement-snapshot:cci-main-category:' || us.id::text),
  us.id,
  us.package_version_id,
  coalesce(ts.target_cvr_ohm, 0),
  us.cci_profile_id,
  us.cci_category_id,
  canonical.main_category,
  canonical.ampe,
  jsonb_build_object(
    'source', 'lucy-cci-main-category-update-2026-07-19',
    'session', canonical.session_no,
    'actionLabel', canonical.action_label,
    'description', canonical.description,
    'unit', 'Ampe',
    'categorySource', canonical.category_source
  ),
  latest.id,
  'Canonical CCI action labels, Ampe values, and Blow/Flow/Chunks main category update.',
  null::uuid
from updated_sections us
join public.test_sections ts on ts.id = us.id
join canonical_cci canonical on canonical.session_no = us.section_order
left join latest_snapshots latest on latest.test_section_id = us.id
where not exists (
  select 1
  from public.section_measurement_snapshots existing
  where existing.id = public.live_test_v2_deterministic_uuid('section-measurement-snapshot:cci-main-category:' || us.id::text)
);
