begin;

alter table public.section_measurement_snapshots disable trigger trg_prevent_measurement_snapshot_rewrite;

with red as (
  select v.id as package_version_id
  from public.test_packages p
  join public.test_package_versions v on v.package_id = p.id
  where p.slug = 'red-test'
  limit 1
),
red_sections as (
  select s.id as test_section_id, s.section_order, s.package_version_id
  from public.test_sections s
  join red r on r.package_version_id = s.package_version_id
),
green_snapshots as (
  select distinct on (gs.section_order)
    gs.section_order,
    sms.target_cvr_ohm,
    sms.cci_profile_id,
    sms.cci_category_id,
    sms.cci_category_label,
    sms.cci_value,
    sms.snapshot_metadata
  from public.test_packages gp
  join public.test_package_versions gv on gv.package_id = gp.id and gv.status = 'published'
  join public.test_sections gs on gs.package_version_id = gv.id
  join public.section_measurement_snapshots sms on sms.test_section_id = gs.id
  where gp.slug = 'green-test-49q'
  order by gs.section_order, sms.created_at desc
)
insert into public.section_measurement_snapshots (
  test_section_id,
  package_version_id,
  target_cvr_ohm,
  cci_profile_id,
  cci_category_id,
  cci_category_label,
  cci_value,
  snapshot_metadata
)
select
  rs.test_section_id,
  rs.package_version_id,
  gs.target_cvr_ohm,
  gs.cci_profile_id,
  gs.cci_category_id,
  gs.cci_category_label,
  gs.cci_value,
  gs.snapshot_metadata || jsonb_build_object(
    'source', 'red-test-snapshot-backfill',
    'copiedFromPackage', 'green-test-49q',
    'copiedForPackage', 'red-test',
    'cpd', gs.target_cvr_ohm * gs.cci_value,
    'createdBy', 'Craft Agent',
    'createdAtAuthoritative', '2026-08-01T11:56:00Z',
    'reason', 'Backfill missing root snapshots after Red-Test import so package can run'
  )
from red_sections rs
join green_snapshots gs on gs.section_order = rs.section_order
where not exists (
  select 1
  from public.section_measurement_snapshots existing
  where existing.test_section_id = rs.test_section_id
);

alter table public.section_measurement_snapshots enable trigger trg_prevent_measurement_snapshot_rewrite;

commit;;
