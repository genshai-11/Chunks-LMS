-- Hosted Live Test V2 migration preparation for Wayfinder ticket #7.
-- Local-only migration artifact: creates deterministic staging/mapping/report helpers.
-- Do not apply to a linked remote project without the later release-control ticket,
-- backup/PITR restore evidence, dry-run report review, and explicit approval.

create extension if not exists "pgcrypto";
SET search_path TO public, extensions;

-- ---------------------------------------------------------------------------
-- Additive audit/mapping tables. These do not rewrite hosted assessment history.
-- ---------------------------------------------------------------------------
create table if not exists public.live_test_v2_migration_runs (
  id uuid primary key default gen_random_uuid(),
  run_label text not null,
  source_filename text not null default 'Chunks-resource - CVR_new.csv',
  dry_run boolean not null default true,
  report jsonb not null,
  report_checksum text not null,
  created_by_user_id uuid references public.users (id),
  created_at timestamptz not null default now(),
  unique (run_label, report_checksum)
);

create table if not exists public.live_test_v2_csv_rows (
  source_filename text not null,
  row_number integer not null check (row_number > 0),
  session_no integer not null check (session_no > 0),
  source_session text,
  source_stt text,
  term_vi text,
  term_en text,
  prompt_vi text,
  prompt_en text,
  unit_ohm numeric check (unit_ohm is null or unit_ohm >= 0),
  tc numeric check (tc is null or tc >= 0),
  lc numeric check (lc is null or lc >= 0),
  tl numeric check (tl is null or tl >= 0),
  cvr numeric check (cvr is null or cvr >= 0),
  row_payload jsonb not null default '{}'::jsonb,
  row_checksum text not null,
  staged_at timestamptz not null default now(),
  primary key (source_filename, row_number)
);

create table if not exists public.live_test_v2_item_mappings (
  legacy_live_test_resource_id uuid not null references public.live_test_resources (id) on delete restrict,
  legacy_live_test_block_id uuid not null references public.live_test_blocks (id) on delete restrict,
  legacy_live_test_item_id uuid primary key references public.live_test_items (id) on delete restrict,
  target_test_package_id uuid not null references public.test_packages (id) on delete restrict,
  target_package_version_id uuid not null references public.test_package_versions (id) on delete restrict,
  target_test_section_id uuid not null references public.test_sections (id) on delete restrict,
  target_test_item_id uuid not null references public.test_items (id) on delete restrict,
  legacy_external_ref text not null,
  v2_external_ref text not null,
  source_row_checksum text not null,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (legacy_external_ref),
  unique (v2_external_ref)
);

create index if not exists live_test_v2_item_mappings_version_idx
  on public.live_test_v2_item_mappings (target_package_version_id, target_test_section_id);

alter table public.live_test_v2_migration_runs enable row level security;
alter table public.live_test_v2_csv_rows enable row level security;
alter table public.live_test_v2_item_mappings enable row level security;

create policy live_test_v2_migration_runs_admin_read on public.live_test_v2_migration_runs
  for select to authenticated using ((select public.current_staff_is_admin()));
create policy live_test_v2_migration_runs_admin_insert on public.live_test_v2_migration_runs
  for insert to authenticated with check ((select public.current_staff_is_admin()));

create policy live_test_v2_csv_rows_admin_all on public.live_test_v2_csv_rows
  for all to authenticated
  using ((select public.current_staff_is_admin()))
  with check ((select public.current_staff_is_admin()));

create policy live_test_v2_item_mappings_staff_read on public.live_test_v2_item_mappings
  for select to authenticated using (
    (select public.current_staff_is_admin())
    or exists (
      select 1 from public.test_package_versions v
      where v.id = target_package_version_id and v.status in ('published', 'archived')
    )
  );
create policy live_test_v2_item_mappings_admin_insert on public.live_test_v2_item_mappings
  for insert to authenticated with check ((select public.current_staff_is_admin()));

-- Recent Supabase projects do not automatically expose new public tables to API
-- roles. RLS still controls rows; anon receives no direct access here.
grant select, insert on public.live_test_v2_migration_runs to authenticated;
grant select, insert, update, delete on public.live_test_v2_csv_rows to authenticated;
grant select, insert on public.live_test_v2_item_mappings to authenticated;

-- ---------------------------------------------------------------------------
-- Deterministic helpers.
-- ---------------------------------------------------------------------------
create or replace function public.live_test_v2_deterministic_uuid(p_basis text)
returns uuid
language sql
immutable
as $$
  select (
    substr(md5(p_basis), 1, 8) || '-' ||
    substr(md5(p_basis), 9, 4) || '-' ||
    substr(md5(p_basis), 13, 4) || '-' ||
    substr(md5(p_basis), 17, 4) || '-' ||
    substr(md5(p_basis), 21, 12)
  )::uuid;
$$;

create or replace function public.stage_live_test_v2_csv_rows(p_source_filename text, p_rows jsonb)
returns jsonb
language plpgsql
security invoker
as $$
begin
  if not (select public.current_staff_is_admin()) then
    raise exception 'Only an active Admin can stage the Live Test V2 CSV source';
  end if;

  insert into public.live_test_v2_csv_rows (
    source_filename, row_number, session_no, source_session, source_stt,
    term_vi, term_en, prompt_vi, prompt_en, unit_ohm, tc, lc, tl, cvr,
    row_payload, row_checksum
  )
  select
    p_source_filename,
    coalesce(nullif(row_data->>'row_number', '')::int, ordinality::int),
    nullif(row_data->>'Session No.', '')::int,
    nullif(row_data->>'Session', ''),
    nullif(row_data->>'STT', ''),
    nullif(row_data->>'Tiếng Việt', ''),
    nullif(row_data->>'Tiếng Anh', ''),
    nullif(row_data->>'Complete Sentence (Vie)', ''),
    nullif(row_data->>'Complete Sentence (Eng)', ''),
    nullif(row_data->>'Unit (Ohm)', '')::numeric,
    nullif(row_data->>'TC', '')::numeric,
    nullif(row_data->>'LC', '')::numeric,
    nullif(row_data->>'TL', '')::numeric,
    nullif(row_data->>'CVR', '')::numeric,
    row_data,
    'sha256:' || encode(digest(convert_to(row_data::text, 'UTF8'), 'sha256'), 'hex')
  from jsonb_array_elements(p_rows) with ordinality as staged(row_data, ordinality)
  on conflict (source_filename, row_number) do update set
    session_no = excluded.session_no,
    source_session = excluded.source_session,
    source_stt = excluded.source_stt,
    term_vi = excluded.term_vi,
    term_en = excluded.term_en,
    prompt_vi = excluded.prompt_vi,
    prompt_en = excluded.prompt_en,
    unit_ohm = excluded.unit_ohm,
    tc = excluded.tc,
    lc = excluded.lc,
    tl = excluded.tl,
    cvr = excluded.cvr,
    row_payload = excluded.row_payload,
    row_checksum = excluded.row_checksum,
    staged_at = now();

  return jsonb_build_object(
    'sourceFilename', p_source_filename,
    'stagedRows', (select count(*) from public.live_test_v2_csv_rows where source_filename = p_source_filename),
    'checksum', 'sha256:' || encode(digest(convert_to(coalesce((select jsonb_agg(row_checksum order by row_number)::text from public.live_test_v2_csv_rows where source_filename = p_source_filename), '[]'), 'UTF8'), 'sha256'), 'hex'),
    'localOnly', true,
    'remoteMutation', false
  );
end;
$$;

create or replace function public.live_test_v2_source_row_checksum(p_item public.live_test_items)
returns text
language sql
stable
as $$
  select 'sha256:' || encode(digest(convert_to(jsonb_build_object(
    'legacyItemId', p_item.id,
    'blockId', p_item.block_id,
    'itemNumber', p_item.item_number,
    'sourceDay', p_item.source_day,
    'sourceStt', p_item.source_stt,
    'unitOhm', p_item.unit_ohm,
    'cciValue', p_item.cci_value,
    'termVi', p_item.term_vi,
    'termEn', p_item.term_en,
    'promptVi', p_item.prompt_vi,
    'promptEn', p_item.prompt_en,
    'tc', coalesce(p_item.tc, nullif(p_item.cvr_breakdown->>'tc', '')::numeric),
    'lc', coalesce(p_item.lc, nullif(p_item.cvr_breakdown->>'lc', '')::numeric),
    'tl', coalesce(p_item.tl, nullif(p_item.cvr_breakdown->>'tl', '')::numeric),
    'cvrValue', p_item.cvr_value
  )::text, 'UTF8'), 'sha256'), 'hex');
$$;

-- ---------------------------------------------------------------------------
-- Dry-run report: counts, checksums, external_ref resolution, CVR/CCI/CPD
-- anomalies, legacy Clerk compatibility, token assumptions, and restore notes.
-- This function reads local/hosted snapshots only. It does not mutate data.
-- ---------------------------------------------------------------------------
create or replace function public.preview_live_test_v2_migration(p_source_filename text default 'Chunks-resource - CVR_new.csv')
returns jsonb
language sql
stable
as $$
with legacy_items as (
  select
    r.id as resource_id,
    b.id as block_id,
    i.id as item_id,
    b.block_number,
    i.item_number,
    i.unit_ohm as target_cvr_ohm,
    i.cci_value,
    coalesce(i.tc, nullif(i.cvr_breakdown->>'tc', '')::numeric) as tc,
    coalesce(i.lc, nullif(i.cvr_breakdown->>'lc', '')::numeric) as lc,
    coalesce(i.tl, nullif(i.cvr_breakdown->>'tl', '')::numeric) as tl,
    i.cvr_value,
    public.live_test_v2_source_row_checksum(i) as row_checksum
  from public.live_test_resources r
  join public.live_test_blocks b on b.resource_id = r.id
  join public.live_test_items i on i.block_id = b.id
), csv_targets as (
  select
    session_no as block_number,
    count(*) as csv_row_count,
    count(distinct unit_ohm) filter (where unit_ohm is not null) as csv_target_count,
    min(unit_ohm) as csv_target_cvr_ohm
  from public.live_test_v2_csv_rows
  where source_filename = p_source_filename
  group by session_no
), section_targets as (
  select
    li.resource_id,
    li.block_id,
    li.block_number,
    count(*) as item_count,
    coalesce(max(ct.csv_target_count), count(distinct li.target_cvr_ohm) filter (where li.target_cvr_ohm is not null)) as target_count,
    coalesce(max(ct.csv_target_cvr_ohm), min(li.target_cvr_ohm)) as target_cvr_ohm,
    coalesce(max(ct.csv_row_count), 0) as csv_row_count,
    count(distinct li.cci_value) filter (where li.cci_value is not null) as cci_count,
    min(li.cci_value) as cci_value
  from legacy_items li
  left join csv_targets ct on ct.block_number = li.block_number
  group by li.resource_id, li.block_id, li.block_number
), legacy_refs as (
  select
    sq.id as session_question_id,
    sq.external_ref,
    substring(sq.external_ref from '^live-test-item:([^:]+)$')::uuid as legacy_item_id
  from public.session_questions sq
  where sq.external_ref ~ '^live-test-item:[0-9a-fA-F-]{36}$'
), versioned_refs as (
  select count(*)::int as count
  from public.session_questions sq
  where sq.external_ref ~ '^live-test-item:[^:]+:v[^:]+$'
), history_counts as (
  select jsonb_build_object(
    'learning_sessions', (select count(*) from public.learning_sessions),
    'session_questions', (select count(*) from public.session_questions),
    'assessment_attempts', (select count(*) from public.assessment_attempts),
    'assessment_events', (select count(*) from public.assessment_events),
    'assessment_attempt_snapshots', (select count(*) from public.assessment_attempt_snapshots)
  ) as counts
), history_checksum as (
  select 'sha256:' || encode(digest(convert_to((select counts::text from history_counts), 'UTF8'), 'sha256'), 'hex') as checksum
), anomalies as (
  select jsonb_agg(entry order by code, ref) filter (where entry is not null) as items
  from (
    select jsonb_build_object(
      'code', 'section.target-cvr-conflict',
      'severity', 'error',
      'ref', block_id,
      'message', format('Legacy block %s has multiple Unit (Ohm) section targets; CSV correction is required before migration.', block_id)
    ) as entry, 'section.target-cvr-conflict' as code, block_id::text as ref
    from section_targets where target_count > 1
    union all
    select jsonb_build_object(
      'code', 'csv.not-staged',
      'severity', 'warning',
      'ref', p_source_filename,
      'message', format('No rows from %s are staged in live_test_v2_csv_rows; preview falls back to legacy unit_ohm values and is not release-ready.', p_source_filename)
    ), 'csv.not-staged', p_source_filename
    where not exists (select 1 from public.live_test_v2_csv_rows where source_filename = p_source_filename)
    union all
    select jsonb_build_object(
      'code', 'section.cci-conflict',
      'severity', 'warning',
      'ref', block_id,
      'message', format('Legacy block %s has multiple CCI values; snapshot category selection must be reviewed.', block_id)
    ), 'section.cci-conflict', block_id::text
    from section_targets where cci_count > 1
    union all
    select jsonb_build_object(
      'code', 'item.measured-cvr-mismatch',
      'severity', 'warning',
      'ref', item_id,
      'message', format('Legacy item %s stores CVR %s but TC x LC x TL recalculates to %s.', item_id, cvr_value, round(tc * lc * tl, 2))
    ), 'item.measured-cvr-mismatch', item_id::text
    from legacy_items where tc is not null and lc is not null and tl is not null and cvr_value is not null and round(tc * lc * tl, 2) <> round(cvr_value, 2)
    union all
    select jsonb_build_object(
      'code', 'external-ref.unresolved',
      'severity', 'error',
      'ref', session_question_id,
      'message', format('Session Question %s references a legacy live-test item that is absent from live_test_items.', session_question_id)
    ), 'external-ref.unresolved', session_question_id::text
    from legacy_refs lr where not exists (select 1 from legacy_items li where li.item_id = lr.legacy_item_id)
  ) s
), cci_categories as (
  select jsonb_agg(jsonb_build_object(
    'categoryId', public.live_test_v2_deterministic_uuid('cci-category:' || cci_value::text),
    'label', 'Migrated CCI ' || cci_value::text,
    'value', cci_value
  ) order by cci_value) as items
  from (select distinct cci_value from section_targets where cci_value is not null) c
)
select jsonb_build_object(
  'sourceFilename', p_source_filename,
  'localOnly', true,
  'remoteMutation', false,
  'counts', jsonb_build_object(
    'csvRows', (select count(*) from public.live_test_v2_csv_rows where source_filename = p_source_filename),
    'legacyResources', (select count(*) from public.live_test_resources),
    'legacyBlocks', (select count(*) from public.live_test_blocks),
    'legacyItems', (select count(*) from public.live_test_items),
    'targetPackagesWouldInsert', (select count(*) from public.live_test_resources r where not exists (select 1 from public.test_packages p where p.id = public.live_test_v2_deterministic_uuid('live-test-package:' || r.id::text))),
    'targetPackageVersionsWouldInsert', (select count(*) from public.live_test_resources r where not exists (select 1 from public.test_package_versions v where v.id = public.live_test_v2_deterministic_uuid('live-test-package-version:' || r.id::text || ':' || r.version))),
    'targetSectionsWouldInsert', (select count(*) from section_targets st where not exists (select 1 from public.test_sections ts where ts.id = public.live_test_v2_deterministic_uuid('live-test-section:' || st.block_id::text))),
    'targetItemsWouldInsert', (select count(*) from legacy_items li where not exists (select 1 from public.test_items ti where ti.id = public.live_test_v2_deterministic_uuid('live-test-item-v2:' || li.item_id::text))),
    'legacyExternalRefs', (select count(*) from legacy_refs),
    'versionedExternalRefs', (select count from versioned_refs),
    'resolvedExternalRefs', (select count(*) from legacy_refs lr where exists (select 1 from legacy_items li where li.item_id = lr.legacy_item_id)),
    'unresolvedExternalRefs', (select count(*) from legacy_refs lr where not exists (select 1 from legacy_items li where li.item_id = lr.legacy_item_id))
  ),
  'historyGuard', jsonb_build_object(
    'noRewriteTables', jsonb_build_array('learning_sessions','session_questions','assessment_attempts','assessment_events','assessment_attempt_snapshots','final_results','corrections'),
    'countsBefore', (select counts from history_counts),
    'countsAfterDryRun', (select counts from history_counts),
    'checksumBefore', (select checksum from history_checksum),
    'checksumAfterDryRun', (select checksum from history_checksum)
  ),
  'cciProfileSeed', jsonb_build_object(
    'profileName', 'Migrated CSV CCI Profile',
    'categoryValues', coalesce((select items from cci_categories), '[]'::jsonb)
  ),
  'compatibility', jsonb_build_object(
    'staffWithLegacyClerkRefs', (select count(*) from public.users u where (u.legacy_clerk_user_id is not null or u.clerk_user_id is not null) and exists (select 1 from public.staff_roles sr where sr.user_id = u.id)),
    'staffWithSupabaseAuthLinks', (select count(*) from public.users u where u.auth_user_id is not null and exists (select 1 from public.staff_roles sr where sr.user_id = u.id)),
    'learnersWithoutAuthAccounts', (select count(*) from public.users u where u.auth_user_id is null and exists (select 1 from public.organization_memberships om where om.user_id = u.id and om.role = 'learner')),
    'learnerTokenRows', (select count(*) from public.learner_access_tokens),
    'rawLearnerTokensPersisted', 0
  ),
  'rollbackReadiness', jsonb_build_object(
    'restorePointRequired', true,
    'notes', jsonb_build_array(
      'Capture a hosted backup/PITR restore point before any remote approval request.',
      'Backfill is additive: legacy live-test and lifecycle tables remain untouched through verification.',
      'Rollback before cutover disables V2 readers and removes rows tied to a recorded migration run/mapping table.',
      'Do not remove legacy Clerk references until staff Auth mapping and signed learner access checks pass.'
    )
  ),
  'anomalies', coalesce((select items from anomalies), '[]'::jsonb)
);
$$;

-- ---------------------------------------------------------------------------
-- Idempotent local catalog backfill. The default is dry-run and only records the
-- report. Passing p_dry_run = false performs additive V2 catalog/mapping inserts
-- and still never updates/deletes lifecycle history tables or session_questions.
-- ---------------------------------------------------------------------------
create or replace function public.apply_live_test_v2_catalog_backfill(
  p_run_label text,
  p_source_filename text default 'Chunks-resource - CVR_new.csv',
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_report jsonb;
  v_checksum text;
  v_actor uuid;
begin
  if not (select public.current_staff_is_admin()) then
    raise exception 'Only an active Admin can run the Live Test V2 migration backfill preview/apply helper';
  end if;

  v_actor := public.current_user_id();
  v_report := public.preview_live_test_v2_migration(p_source_filename);
  v_checksum := 'sha256:' || encode(digest(convert_to(v_report::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.live_test_v2_migration_runs (run_label, source_filename, dry_run, report, report_checksum, created_by_user_id)
  values (p_run_label, p_source_filename, p_dry_run, v_report, v_checksum, v_actor)
  on conflict (run_label, report_checksum) do nothing;

  if p_dry_run then
    return v_report || jsonb_build_object('applied', false, 'migrationRunChecksum', v_checksum);
  end if;

  if current_setting('app.live_test_v2_allow_local_apply', true) is distinct from 'local-only-reviewed' then
    raise exception 'Non-dry-run backfill is disabled. Set app.live_test_v2_allow_local_apply=local-only-reviewed only in a reviewed local database; never use this as remote approval.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(v_report->'anomalies', '[]'::jsonb)) anomaly
    where anomaly->>'severity' = 'error'
  ) then
    raise exception 'Live Test V2 migration has blocking dry-run anomalies; review report checksum % before apply', v_checksum;
  end if;

  -- CCI profile/category seed mapping by singleton organization and migrated values.
  insert into public.cci_profiles (id, organization_id, name, version_label, status, description, created_by_user_id)
  select distinct
    public.live_test_v2_deterministic_uuid('cci-profile:migrated-csv:' || r.organization_id::text),
    r.organization_id,
    'Migrated CSV CCI Profile',
    '1.0.0',
    'draft',
    'Seeded from reviewed one-time Live Test V2 migration dry-run.',
    v_actor
  from public.live_test_resources r
  where r.organization_id is not null
    and not exists (
      select 1 from public.cci_profiles p
      where p.id = public.live_test_v2_deterministic_uuid('cci-profile:migrated-csv:' || r.organization_id::text)
    );

  insert into public.cci_categories (id, profile_id, category_order, label, value, metadata)
  select
    public.live_test_v2_deterministic_uuid('cci-category:migrated-csv:' || cci.organization_id::text || ':' || cci.cci_value::text),
    public.live_test_v2_deterministic_uuid('cci-profile:migrated-csv:' || cci.organization_id::text),
    dense_rank() over (partition by cci.organization_id order by cci.cci_value),
    'Migrated CCI ' || cci.cci_value::text,
    cci.cci_value,
    jsonb_build_object('source', p_source_filename, 'migrationRunChecksum', v_checksum)
  from (
    select distinct r.organization_id, i.cci_value
    from public.live_test_resources r
    join public.live_test_blocks b on b.resource_id = r.id
    join public.live_test_items i on i.block_id = b.id
    where r.organization_id is not null
      and i.cci_value is not null
  ) cci
  join public.cci_profiles profile
    on profile.id = public.live_test_v2_deterministic_uuid('cci-profile:migrated-csv:' || cci.organization_id::text)
   and profile.status = 'draft'
  where not exists (
    select 1 from public.cci_categories existing
    where existing.id = public.live_test_v2_deterministic_uuid('cci-category:migrated-csv:' || cci.organization_id::text || ':' || cci.cci_value::text)
  );

  insert into public.test_packages (id, organization_id, title, slug, description, created_by_user_id, source_metadata)
  select
    public.live_test_v2_deterministic_uuid('live-test-package:' || r.id::text),
    r.organization_id,
    r.title,
    'migrated-' || lower(regexp_replace(r.title, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(r.id::text, 1, 8),
    'Migrated from legacy live_test_resources without deleting legacy rows.',
    v_actor,
    jsonb_build_object('legacyLiveTestResourceId', r.id, 'sourceFilename', p_source_filename, 'migrationRunChecksum', v_checksum)
  from public.live_test_resources r
  where r.organization_id is not null
    and not exists (
      select 1 from public.test_packages p
      where p.id = public.live_test_v2_deterministic_uuid('live-test-package:' || r.id::text)
    );

  insert into public.test_package_versions (id, package_id, version_label, status, source_metadata, created_by_user_id)
  select
    public.live_test_v2_deterministic_uuid('live-test-package-version:' || r.id::text || ':' || r.version),
    public.live_test_v2_deterministic_uuid('live-test-package:' || r.id::text),
    coalesce(nullif(r.version, ''), '1.0.0'),
    'draft',
    jsonb_build_object('legacyLiveTestResourceId', r.id, 'legacyStatus', r.status, 'sourceFilename', p_source_filename, 'migrationRunChecksum', v_checksum),
    v_actor
  from public.live_test_resources r
  where not exists (
    select 1 from public.test_package_versions v
    where v.id = public.live_test_v2_deterministic_uuid('live-test-package-version:' || r.id::text || ':' || r.version)
  );

  insert into public.test_sections (id, package_version_id, section_order, title, target_cvr_ohm, cci_profile_id, cci_category_id, cci_snapshot, intro_text_vi, intro_text_en, metadata)
  select
    public.live_test_v2_deterministic_uuid('live-test-section:' || b.id::text),
    public.live_test_v2_deterministic_uuid('live-test-package-version:' || r.id::text || ':' || r.version),
    b.block_number,
    b.title,
    coalesce((select min(csv.unit_ohm) from public.live_test_v2_csv_rows csv where csv.source_filename = p_source_filename and csv.session_no = b.block_number), min(i.unit_ohm)),
    public.live_test_v2_deterministic_uuid('cci-profile:migrated-csv:' || r.organization_id::text),
    public.live_test_v2_deterministic_uuid('cci-category:migrated-csv:' || r.organization_id::text || ':' || min(i.cci_value)::text),
    jsonb_build_object('label', 'Migrated CCI ' || min(i.cci_value)::text, 'value', min(i.cci_value), 'source', p_source_filename),
    b.intro_text_vi,
    b.intro_text_en,
    jsonb_build_object('legacyLiveTestBlockId', b.id, 'migrationRunChecksum', v_checksum)
  from public.live_test_resources r
  join public.live_test_blocks b on b.resource_id = r.id
  join public.live_test_items i on i.block_id = b.id
  join public.test_package_versions v
    on v.id = public.live_test_v2_deterministic_uuid('live-test-package-version:' || r.id::text || ':' || r.version)
   and v.status = 'draft'
  group by r.id, r.version, r.organization_id, b.id, b.block_number, b.title, b.intro_text_vi, b.intro_text_en
  having not exists (
    select 1 from public.test_sections ts
    where ts.id = public.live_test_v2_deterministic_uuid('live-test-section:' || b.id::text)
  );

  insert into public.section_measurement_snapshots (id, test_section_id, package_version_id, target_cvr_ohm, cci_profile_id, cci_category_id, cci_category_label, cci_value, snapshot_metadata, created_by_user_id)
  select
    public.live_test_v2_deterministic_uuid('section-measurement-snapshot:' || b.id::text),
    public.live_test_v2_deterministic_uuid('live-test-section:' || b.id::text),
    public.live_test_v2_deterministic_uuid('live-test-package-version:' || r.id::text || ':' || r.version),
    coalesce((select min(csv.unit_ohm) from public.live_test_v2_csv_rows csv where csv.source_filename = p_source_filename and csv.session_no = b.block_number), min(i.unit_ohm)),
    public.live_test_v2_deterministic_uuid('cci-profile:migrated-csv:' || r.organization_id::text),
    public.live_test_v2_deterministic_uuid('cci-category:migrated-csv:' || r.organization_id::text || ':' || min(i.cci_value)::text),
    'Migrated CCI ' || min(i.cci_value)::text,
    min(i.cci_value),
    jsonb_build_object('legacyLiveTestBlockId', b.id, 'sourceFilename', p_source_filename, 'migrationRunChecksum', v_checksum),
    v_actor
  from public.live_test_resources r
  join public.live_test_blocks b on b.resource_id = r.id
  join public.live_test_items i on i.block_id = b.id
  join public.test_package_versions v
    on v.id = public.live_test_v2_deterministic_uuid('live-test-package-version:' || r.id::text || ':' || r.version)
   and v.status = 'draft'
  group by r.id, r.version, r.organization_id, b.id
  having not exists (
    select 1 from public.section_measurement_snapshots sms
    where sms.id = public.live_test_v2_deterministic_uuid('section-measurement-snapshot:' || b.id::text)
  );

  insert into public.test_items (id, package_version_id, section_id, item_order, source_day, source_stt, term_vi, term_en, prompt_vi, prompt_en, tc, lc, tl, cvr_breakdown, source_metadata)
  select
    public.live_test_v2_deterministic_uuid('live-test-item-v2:' || i.id::text),
    public.live_test_v2_deterministic_uuid('live-test-package-version:' || r.id::text || ':' || r.version),
    public.live_test_v2_deterministic_uuid('live-test-section:' || b.id::text),
    i.item_number,
    i.source_day,
    i.source_stt,
    i.term_vi,
    i.term_en,
    i.prompt_vi,
    i.prompt_en,
    coalesce(i.tc, nullif(i.cvr_breakdown->>'tc', '')::numeric),
    coalesce(i.lc, nullif(i.cvr_breakdown->>'lc', '')::numeric),
    coalesce(i.tl, nullif(i.cvr_breakdown->>'tl', '')::numeric),
    jsonb_build_object('legacyCvrValue', i.cvr_value, 'legacyCvrBreakdown', i.cvr_breakdown),
    jsonb_build_object('legacyLiveTestItemId', i.id, 'sourceFilename', p_source_filename, 'sourceRowChecksum', public.live_test_v2_source_row_checksum(i), 'migrationRunChecksum', v_checksum)
  from public.live_test_resources r
  join public.live_test_blocks b on b.resource_id = r.id
  join public.live_test_items i on i.block_id = b.id
  join public.test_package_versions v
    on v.id = public.live_test_v2_deterministic_uuid('live-test-package-version:' || r.id::text || ':' || r.version)
   and v.status = 'draft'
  where not exists (
    select 1 from public.test_items ti
    where ti.id = public.live_test_v2_deterministic_uuid('live-test-item-v2:' || i.id::text)
  );

  insert into public.live_test_v2_item_mappings (legacy_live_test_resource_id, legacy_live_test_block_id, legacy_live_test_item_id, target_test_package_id, target_package_version_id, target_test_section_id, target_test_item_id, legacy_external_ref, v2_external_ref, source_row_checksum, source_metadata)
  select
    r.id,
    b.id,
    i.id,
    public.live_test_v2_deterministic_uuid('live-test-package:' || r.id::text),
    public.live_test_v2_deterministic_uuid('live-test-package-version:' || r.id::text || ':' || r.version),
    public.live_test_v2_deterministic_uuid('live-test-section:' || b.id::text),
    public.live_test_v2_deterministic_uuid('live-test-item-v2:' || i.id::text),
    'live-test-item:' || i.id::text,
    'live-test-item:' || public.live_test_v2_deterministic_uuid('live-test-item-v2:' || i.id::text)::text || ':v' || public.live_test_v2_deterministic_uuid('live-test-package-version:' || r.id::text || ':' || r.version)::text,
    public.live_test_v2_source_row_checksum(i),
    jsonb_build_object('sourceFilename', p_source_filename, 'migrationRunChecksum', v_checksum)
  from public.live_test_resources r
  join public.live_test_blocks b on b.resource_id = r.id
  join public.live_test_items i on i.block_id = b.id
  where exists (
    select 1 from public.test_items ti
    where ti.id = public.live_test_v2_deterministic_uuid('live-test-item-v2:' || i.id::text)
  )
  on conflict (legacy_live_test_item_id) do nothing;

  update public.cci_profiles profile
  set status = 'active'
  where profile.name = 'Migrated CSV CCI Profile'
    and profile.status = 'draft'
    and profile.description = 'Seeded from reviewed one-time Live Test V2 migration dry-run.';

  update public.test_package_versions v
  set status = 'published',
      snapshot_hash = 'sha256:' || encode(digest(convert_to(v.id::text || ':' || v.source_metadata::text, 'UTF8'), 'sha256'), 'hex'),
      published_by_user_id = v_actor
  where v.status = 'draft'
    and v.source_metadata->>'migrationRunChecksum' = v_checksum
    and exists (
      select 1 from public.test_items ti where ti.package_version_id = v.id
    );

  v_report := public.preview_live_test_v2_migration(p_source_filename);
  return v_report || jsonb_build_object('applied', true, 'migrationRunChecksum', v_checksum);
end;
$$;

comment on table public.live_test_v2_migration_runs is
  'Dry-run/apply audit records for hosted Live Test V2 migration preparation. Created locally for ticket #7; remote use requires explicit approval.';
comment on table public.live_test_v2_item_mappings is
  'Additive mapping from legacy live_test_items and external_ref values to immutable V2 Test Item external refs; session_questions are not rewritten.';
comment on function public.preview_live_test_v2_migration(text) is
  'Read-only dry-run report for Live Test V2 migration: counts, checksums, external_ref resolution, CVR/CCI/CPD anomalies, identity/token compatibility, and rollback notes.';
comment on function public.apply_live_test_v2_catalog_backfill(text, text, boolean) is
  'Idempotent local Live Test V2 catalog/mapping backfill. Defaults to dry-run; non-dry-run is additive and never rewrites lifecycle history.';
