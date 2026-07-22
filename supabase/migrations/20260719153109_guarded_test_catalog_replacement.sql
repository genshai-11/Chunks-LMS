-- Dry-run preview + guarded transactional replacement of obsolete test-only
-- data. This migration defines the operation but does not execute it.

create or replace function private.obsolete_test_catalog_scope()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with legacy_resources as (
    select id from public.live_test_resources
    where source_filename = 'Chunks-resource - CVR_new.csv'
       or title = 'CCI CVR Live Test'
  ), old_packages as (
    select id from public.test_packages
    where title = 'CCI CVR Live Test'
       or slug like 'migrated-%'
       or source_metadata ? 'legacyLiveTestResourceId'
  ), old_versions as (
    select id from public.test_package_versions
    where package_id in (select id from old_packages)
  ), old_profiles as (
    select distinct s.cci_profile_id as id
    from public.test_sections s
    where s.package_version_id in (select id from old_versions)
      and s.cci_profile_id is not null
  ), old_sessions as (
    select id from public.learning_sessions
    where session_format = 'test'
      and (
        live_test_resource_id in (select id from legacy_resources)
        or test_package_version_id in (select id from old_versions)
      )
  )
  select jsonb_build_object(
    'legacyResourceIds', coalesce((select jsonb_agg(id::text order by id) from legacy_resources), '[]'::jsonb),
    'packageIds', coalesce((select jsonb_agg(id::text order by id) from old_packages), '[]'::jsonb),
    'packageVersionIds', coalesce((select jsonb_agg(id::text order by id) from old_versions), '[]'::jsonb),
    'cciProfileIds', coalesce((select jsonb_agg(id::text order by id) from old_profiles), '[]'::jsonb),
    'learningSessionIds', coalesce((select jsonb_agg(id::text order by id) from old_sessions), '[]'::jsonb)
  )
$$;

create or replace function private.obsolete_test_catalog_counts(p_scope jsonb)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with resource_ids as (
    select value::uuid id from jsonb_array_elements_text(p_scope->'legacyResourceIds')
  ), package_ids as (
    select value::uuid id from jsonb_array_elements_text(p_scope->'packageIds')
  ), version_ids as (
    select value::uuid id from jsonb_array_elements_text(p_scope->'packageVersionIds')
  ), session_ids as (
    select value::uuid id from jsonb_array_elements_text(p_scope->'learningSessionIds')
  )
  select jsonb_build_object(
    'legacyResources', (select count(*) from public.live_test_resources where id in (select id from resource_ids)),
    'legacyBlocks', (select count(*) from public.live_test_blocks where resource_id in (select id from resource_ids)),
    'legacyItems', (select count(*) from public.live_test_items where block_id in (select id from public.live_test_blocks where resource_id in (select id from resource_ids))),
    'packages', (select count(*) from public.test_packages where id in (select id from package_ids)),
    'packageVersions', (select count(*) from public.test_package_versions where id in (select id from version_ids)),
    'sections', (select count(*) from public.test_sections where package_version_id in (select id from version_ids)),
    'items', (select count(*) from public.test_items where package_version_id in (select id from version_ids)),
    'measurementSnapshots', (select count(*) from public.section_measurement_snapshots where package_version_id in (select id from version_ids)),
    'learningSessions', (select count(*) from public.learning_sessions where id in (select id from session_ids)),
    'sessionQuestions', (select count(*) from public.session_questions where learning_session_id in (select id from session_ids)),
    'attempts', (select count(*) from public.assessment_attempts where learning_session_id in (select id from session_ids)),
    'events', (select count(*) from public.assessment_events where attempt_id in (select id from public.assessment_attempts where learning_session_id in (select id from session_ids))),
    'snapshots', (select count(*) from public.assessment_attempt_snapshots where attempt_id in (select id from public.assessment_attempts where learning_session_id in (select id from session_ids))),
    'mappings', (select count(*) from public.live_test_v2_item_mappings where target_package_version_id in (select id from version_ids) or legacy_live_test_resource_id in (select id from resource_ids))
  )
$$;

revoke execute on function private.obsolete_test_catalog_scope() from public, anon, authenticated;
revoke execute on function private.obsolete_test_catalog_counts(jsonb) from public, anon, authenticated;
grant execute on function private.obsolete_test_catalog_scope() to service_role;
grant execute on function private.obsolete_test_catalog_counts(jsonb) to service_role;

create or replace function public.preview_test_catalog_replacement(
  p_source_sha256 text,
  p_manifest jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_actor uuid;
  v_org uuid;
  v_scope jsonb;
  v_counts jsonb;
  v_manifest_sha text;
  v_token text;
  v_run_id uuid;
  v_error_count integer;
  v_item_count integer;
begin
  if not public.current_staff_is_admin() then
    raise exception 'Admin role required for test catalog replacement preview' using errcode = '42501';
  end if;
  v_actor := public.current_staff_user_id();
  select om.organization_id into v_org
  from public.organization_memberships om
  where om.user_id = v_actor and om.role = 'admin'
  order by om.created_at
  limit 1;
  if v_org is null then raise exception 'Admin organization membership not found'; end if;

  if p_source_sha256 !~ '^[a-f0-9]{64}$' or p_manifest->'source'->>'sha256' <> p_source_sha256 then
    raise exception 'Source SHA-256 does not match manifest';
  end if;
  if jsonb_array_length(coalesce(p_manifest->'sessions','[]'::jsonb)) <> 8
     or jsonb_array_length(coalesce(p_manifest->'cciDefinitions','[]'::jsonb)) <> 8 then
    raise exception 'Canonical manifest must contain 8 sessions and 8 CCI definitions';
  end if;
  select coalesce(sum(jsonb_array_length(session->'items')),0)::int
    into v_item_count
  from jsonb_array_elements(p_manifest->'sessions') session;
  if v_item_count <> 80 then raise exception 'Canonical manifest must contain 80 items'; end if;
  select count(*)::int into v_error_count
  from jsonb_array_elements(coalesce(p_manifest->'issues','[]'::jsonb)) issue
  where issue->>'severity' = 'error';
  if v_error_count > 0 then raise exception 'Canonical manifest contains validation errors'; end if;

  v_scope := private.obsolete_test_catalog_scope();
  v_counts := private.obsolete_test_catalog_counts(v_scope);
  v_manifest_sha := encode(extensions.digest(p_manifest::text, 'sha256'), 'hex');
  v_token := encode(extensions.digest(concat_ws('|', p_source_sha256, v_manifest_sha, v_counts::text, v_scope::text), 'sha256'), 'hex');

  insert into public.test_catalog_import_runs (
    organization_id, source_filename, source_sha256, manifest_sha256, manifest,
    preview_counts, validation_issues, deletion_scope, confirmation_token,
    previewed_by_user_id
  ) values (
    v_org, p_manifest->'source'->>'filename', p_source_sha256, v_manifest_sha, p_manifest,
    v_counts, coalesce(p_manifest->'issues','[]'::jsonb), v_scope, v_token, v_actor
  ) returning id into v_run_id;

  return jsonb_build_object(
    'importRunId', v_run_id,
    'sourceSha256', p_source_sha256,
    'manifestSha256', v_manifest_sha,
    'canonicalCounts', jsonb_build_object('packages',1,'sessions',8,'items',80,'cciDefinitions',8),
    'deleteCounts', v_counts,
    'deletionScope', v_scope,
    'issues', coalesce(p_manifest->'issues','[]'::jsonb),
    'confirmationToken', v_token,
    'canConfirm', true,
    'remoteMutation', false
  );
end;
$$;

create or replace function private.catalog_reset_allows_version_delete(p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.current_staff_is_admin()
    and exists (
      select 1 from public.test_catalog_import_runs run
      where run.id::text = current_setting('app.catalog_reset_import_run_id', true)
        and run.status = 'running'
        and (run.deletion_scope->'packageVersionIds') @> jsonb_build_array(p_version_id::text)
    )
$$;

revoke execute on function private.catalog_reset_allows_version_delete(uuid) from public, anon, authenticated;
grant execute on function private.catalog_reset_allows_version_delete(uuid) to service_role;

create or replace function public.freeze_published_package_version()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'draft' or private.catalog_reset_allows_version_delete(old.id) then return old; end if;
    raise exception 'Published Package Versions are immutable';
  end if;
  if old.status <> 'draft' then
    if old.status = 'published'
      and new.status = 'archived'
      and new.package_id is not distinct from old.package_id
      and new.version_label is not distinct from old.version_label
      and new.draft_of_version_id is not distinct from old.draft_of_version_id
      and new.snapshot_hash is not distinct from old.snapshot_hash
      and new.source_metadata is not distinct from old.source_metadata
      and new.created_by_user_id is not distinct from old.created_by_user_id
      and new.created_at is not distinct from old.created_at
      and new.published_at is not distinct from old.published_at
    then
      new.archived_at = coalesce(new.archived_at, now());
      new.updated_at = now();
      return new;
    end if;
    raise exception 'Published Package Versions are immutable';
  end if;
  if new.status = 'published' then new.published_at = coalesce(new.published_at, now()); end if;
  if new.status = 'archived' then new.archived_at = coalesce(new.archived_at, now()); end if;
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.apply_test_catalog_replacement(
  p_import_run_id uuid,
  p_confirmation_token text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  run public.test_catalog_import_runs%rowtype;
  v_actor uuid;
  v_scope jsonb;
  v_counts jsonb;
  v_resource_ids uuid[];
  v_package_ids uuid[];
  v_version_ids uuid[];
  v_profile_ids uuid[];
  v_session_ids uuid[];
  v_profile_id uuid;
  v_package_id uuid;
  v_version_id uuid;
  v_cci jsonb;
  v_session jsonb;
  v_item jsonb;
  v_category_id uuid;
  v_section_id uuid;
  v_error_code text;
  v_error_message text;
begin
  if not public.current_staff_is_admin() then
    raise exception 'Admin role required for test catalog replacement' using errcode = '42501';
  end if;
  v_actor := public.current_staff_user_id();
  select * into run from public.test_catalog_import_runs where id = p_import_run_id for update;
  if run.id is null then raise exception 'Import run not found'; end if;
  if run.status <> 'previewed' then raise exception 'Import run is not previewed'; end if;
  if run.confirmation_token <> p_confirmation_token then raise exception 'Confirmation token mismatch'; end if;

  v_scope := private.obsolete_test_catalog_scope();
  v_counts := private.obsolete_test_catalog_counts(v_scope);
  if v_scope is distinct from run.deletion_scope or v_counts is distinct from run.preview_counts then
    raise exception 'Deletion scope/count drift detected; run a new preview';
  end if;

  update public.test_catalog_import_runs
  set status='running', confirmed_by_user_id=v_actor, confirmed_at=now(), started_at=now()
  where id=run.id;

  begin
    perform set_config('app.catalog_reset_import_run_id', run.id::text, true);
    select coalesce(array_agg(value::uuid),'{}') into v_resource_ids from jsonb_array_elements_text(v_scope->'legacyResourceIds');
    select coalesce(array_agg(value::uuid),'{}') into v_package_ids from jsonb_array_elements_text(v_scope->'packageIds');
    select coalesce(array_agg(value::uuid),'{}') into v_version_ids from jsonb_array_elements_text(v_scope->'packageVersionIds');
    select coalesce(array_agg(value::uuid),'{}') into v_profile_ids from jsonb_array_elements_text(v_scope->'cciProfileIds');
    select coalesce(array_agg(value::uuid),'{}') into v_session_ids from jsonb_array_elements_text(v_scope->'learningSessionIds');

    delete from public.assessment_events where attempt_id in (select id from public.assessment_attempts where learning_session_id = any(v_session_ids));
    delete from public.assessment_attempt_snapshots where attempt_id in (select id from public.assessment_attempts where learning_session_id = any(v_session_ids));
    delete from public.assessment_attempts where learning_session_id = any(v_session_ids);
    delete from public.session_questions where learning_session_id = any(v_session_ids);
    delete from public.learning_sessions where id = any(v_session_ids);
    delete from public.live_test_v2_item_mappings where target_package_version_id = any(v_version_ids) or legacy_live_test_resource_id = any(v_resource_ids);
    delete from public.test_packages where id = any(v_package_ids);
    delete from public.cci_profiles where id = any(v_profile_ids);
    delete from public.live_test_resources where id = any(v_resource_ids);
    delete from public.live_test_v2_csv_rows where source_filename in ('Chunks-resource - CVR_new.csv','Chunks Resource.xlsx');
    delete from public.live_test_v2_migration_runs where source_filename in ('Chunks-resource - CVR_new.csv','Chunks Resource.xlsx');

    v_profile_id := public.live_test_v2_deterministic_uuid('canonical-standalone-cci:' || run.source_sha256);
    insert into public.cci_profiles(id, organization_id, name, version_label, status, description, created_by_user_id)
    values (v_profile_id, run.organization_id, 'Chunks Resource CCI', 'draft-v1', 'draft', 'Canonical CCI definitions from Chunks Resource.xlsx', v_actor);

    for v_cci in select value from jsonb_array_elements(run.manifest->'cciDefinitions') loop
      v_category_id := public.live_test_v2_deterministic_uuid('canonical-standalone-cci:' || run.source_sha256 || ':' || (v_cci->>'sourceCciId'));
      insert into public.cci_categories(id, profile_id, category_order, label, value, description, metadata)
      values (
        v_category_id, v_profile_id, (v_cci->>'sessionOrder')::int, v_cci->>'name', (v_cci->>'ampe')::numeric,
        coalesce(v_cci->>'description',''),
        jsonb_build_object('source','Chunks Resource.xlsx','sourceCciId',v_cci->>'sourceCciId','mainCategory',v_cci->'category')
      );
    end loop;

    v_package_id := public.live_test_v2_deterministic_uuid('canonical-standalone-package:' || run.source_sha256);
    v_version_id := public.live_test_v2_deterministic_uuid('canonical-standalone-version:' || run.source_sha256);
    insert into public.test_packages(id, organization_id, title, slug, description, created_by_user_id, source_metadata)
    values (v_package_id, run.organization_id, run.manifest->'package'->>'title', 'pre-test-standalone-canonical', run.manifest->'package'->>'description', v_actor,
      jsonb_build_object('source','Chunks Resource.xlsx','sourceSha256',run.source_sha256,'importRunId',run.id));
    insert into public.test_package_versions(id, package_id, version_label, status, source_metadata, created_by_user_id)
    values (v_version_id, v_package_id, run.manifest->'package'->>'versionLabel', 'draft',
      jsonb_build_object('sourceSha256',run.source_sha256,'manifestSha256',run.manifest_sha256,'sessions',8,'items',80), v_actor);

    for v_session in select value from jsonb_array_elements(run.manifest->'sessions') loop
      v_section_id := public.live_test_v2_deterministic_uuid('canonical-standalone-section:' || run.source_sha256 || ':' || (v_session->>'sessionOrder'));
      v_category_id := public.live_test_v2_deterministic_uuid('canonical-standalone-cci:' || run.source_sha256 || ':' || (v_session->>'sourceCciId'));
      select value into v_cci from jsonb_array_elements(run.manifest->'cciDefinitions') value where value->>'sourceCciId'=v_session->>'sourceCciId';
      insert into public.test_sections(id, package_version_id, section_order, title, target_cvr_ohm, cci_profile_id, cci_category_id, cci_snapshot, intro_text_vi, intro_text_en, metadata)
      values (
        v_section_id, v_version_id, (v_session->>'sessionOrder')::int, v_session->>'name', (v_session->>'targetCvrOhm')::numeric,
        v_profile_id, v_category_id,
        jsonb_build_object('sourceCciId',v_session->>'sourceCciId','label',v_cci->>'name','value',(v_cci->>'ampe')::numeric,'unit','Ampe'),
        v_session->>'introTextVi', v_session->>'introTextEn',
        jsonb_build_object('source','Chunks Resource.xlsx','description',v_session->>'description')
      );
      insert into public.section_measurement_snapshots(id, test_section_id, package_version_id, target_cvr_ohm, cci_profile_id, cci_category_id, cci_category_label, cci_value, snapshot_metadata, created_by_user_id)
      values (
        public.live_test_v2_deterministic_uuid('canonical-standalone-snapshot:' || run.source_sha256 || ':' || (v_session->>'sessionOrder')),
        v_section_id, v_version_id, (v_session->>'targetCvrOhm')::numeric, v_profile_id, v_category_id,
        v_cci->>'name', (v_cci->>'ampe')::numeric,
        jsonb_build_object('source','Chunks Resource.xlsx','sourceCciId',v_session->>'sourceCciId','unit','Ampe'), v_actor
      );
      for v_item in select value from jsonb_array_elements(v_session->'items') loop
        insert into public.test_items(id, package_version_id, section_id, item_order, source_day, source_stt, term_vi, term_en, prompt_vi, prompt_en, tc, lc, tl, source_metadata)
        values (
          public.live_test_v2_deterministic_uuid('canonical-standalone-item:' || run.source_sha256 || ':' || (v_session->>'sessionOrder') || ':' || (v_item->>'itemOrder')),
          v_version_id, v_section_id, (v_item->>'itemOrder')::int, v_item->>'sourceMaterial', v_item->>'sourceItemId',
          v_item->>'termVi', v_item->>'termEn', v_item->>'promptVi', v_item->>'promptEn',
          (v_session->>'targetCvrOhm')::numeric, 1, 1,
          jsonb_build_object('source','Chunks Resource.xlsx','sourceCciId',v_item->>'sourceCciId','sessionCciId',v_session->>'sourceCciId','sourceCvrId',(v_item->>'sourceCvrId')::numeric)
        );
      end loop;
    end loop;

    update public.test_catalog_import_runs set
      status='succeeded', actual_counts=v_counts, completed_at=now(),
      canonical_package_id=v_package_id, canonical_package_version_id=v_version_id,
      error_code=null, error_message=null
    where id=run.id;

    return jsonb_build_object('status','succeeded','importRunId',run.id,'packageId',v_package_id,'packageVersionId',v_version_id,'deleted',v_counts,'inserted',jsonb_build_object('packages',1,'sessions',8,'items',80,'cciDefinitions',8));
  exception when others then
    get stacked diagnostics v_error_code = returned_sqlstate, v_error_message = message_text;
    update public.test_catalog_import_runs set status='failed', completed_at=now(), error_code=v_error_code, error_message=v_error_message where id=run.id;
    return jsonb_build_object('status','failed','importRunId',run.id,'errorCode',v_error_code,'errorMessage',v_error_message);
  end;
end;
$$;

revoke execute on function public.preview_test_catalog_replacement(text, jsonb) from public, anon;
revoke execute on function public.apply_test_catalog_replacement(uuid, text) from public, anon;
grant execute on function public.preview_test_catalog_replacement(text, jsonb) to authenticated, service_role;
grant execute on function public.apply_test_catalog_replacement(uuid, text) to authenticated, service_role;

comment on function public.preview_test_catalog_replacement(text, jsonb) is
  'Read-only impact preview plus durable confirmation token for canonical test replacement.';
comment on function public.apply_test_catalog_replacement(uuid, text) is
  'Guarded transaction: delete only previewed obsolete test graph and insert canonical draft package.';
