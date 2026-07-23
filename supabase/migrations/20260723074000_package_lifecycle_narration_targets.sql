-- Support package-level Live Test lifecycle narration targets:
-- package_start (before a run begins) and package_end (after summary/finish).

alter table public.narration_variants
  drop constraint if exists narration_variants_narration_target_check,
  drop constraint if exists narration_variants_check;

alter table public.narration_variants
  add constraint narration_variants_narration_target_check
  check (narration_target in ('package_start','package_end','section_intro','test_item')),
  add constraint narration_variants_target_shape_check
  check (
    (narration_target in ('package_start','package_end') and test_section_id is null and test_item_id is null)
    or
    (narration_target = 'section_intro' and test_section_id is not null and test_item_id is null)
    or
    (narration_target = 'test_item' and test_item_id is not null and test_section_id is null)
  );

alter table public.generation_jobs
  drop constraint if exists generation_jobs_job_type_check;

alter table public.generation_jobs
  add constraint generation_jobs_job_type_check
  check (job_type in ('test_item','section_intro_narration','item_narration','package_start_narration','package_end_narration'));

create index if not exists narration_variants_package_lifecycle_idx
  on public.narration_variants(package_version_id, narration_target, language, voice_id, created_at desc)
  where narration_target in ('package_start','package_end');

comment on constraint narration_variants_target_shape_check on public.narration_variants is
  'Package lifecycle narration has no section/item FK; section intro and test item narration remain scoped.';
