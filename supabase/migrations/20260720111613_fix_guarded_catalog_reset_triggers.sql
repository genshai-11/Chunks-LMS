-- Hotfix: cascade deletes from the guarded canonical replacement must be able
-- to remove immutable child rows, but only for IDs stored on the active import
-- run and only while that run is in status=running.
create or replace function private.catalog_reset_allows_profile_delete(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select public.current_staff_is_admin()
    and exists (
      select 1 from public.test_catalog_import_runs run
      where run.id::text = current_setting('app.catalog_reset_import_run_id', true)
        and run.status = 'running'
        and (run.deletion_scope->'cciProfileIds') @> jsonb_build_array(p_profile_id::text)
    )
$$;
revoke execute on function private.catalog_reset_allows_profile_delete(uuid) from public, anon, authenticated;
grant execute on function private.catalog_reset_allows_profile_delete(uuid) to service_role;
create or replace function public.ensure_section_parent_version_is_draft()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_package_version_id uuid;
begin
  v_package_version_id := case when tg_op='DELETE' then old.package_version_id else new.package_version_id end;
  if tg_op='DELETE' and private.catalog_reset_allows_version_delete(v_package_version_id) then return old; end if;
  perform public.require_draft_test_package_version(v_package_version_id);
  if tg_op in ('INSERT','UPDATE') then new.updated_at=now(); return new; end if;
  return old;
end;
$$;
create or replace function public.ensure_item_parent_version_is_draft()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_package_version_id uuid; v_section_version_id uuid;
begin
  v_package_version_id := case when tg_op='DELETE' then old.package_version_id else new.package_version_id end;
  if tg_op='DELETE' and private.catalog_reset_allows_version_delete(v_package_version_id) then return old; end if;
  perform public.require_draft_test_package_version(v_package_version_id);
  if tg_op in ('INSERT','UPDATE') then
    select package_version_id into v_section_version_id from public.test_sections where id=new.section_id;
    if v_section_version_id is distinct from new.package_version_id then
      raise exception 'Test Item Package Version must match its Test Section Package Version';
    end if;
    new.updated_at=now(); return new;
  end if;
  return old;
end;
$$;
create or replace function public.ensure_narration_parent_version_is_draft()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_package_version_id uuid;
begin
  v_package_version_id := case when tg_op='DELETE' then old.package_version_id else new.package_version_id end;
  if tg_op='DELETE' and private.catalog_reset_allows_version_delete(v_package_version_id) then return old; end if;
  perform public.require_draft_test_package_version(v_package_version_id);
  if tg_op in ('INSERT','UPDATE') then new.updated_at=now(); return new; end if;
  return old;
end;
$$;
create or replace function public.prevent_measurement_snapshot_rewrite()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_status text; v_section_version_id uuid; v_category_profile_id uuid;
begin
  if tg_op='DELETE' then
    if private.catalog_reset_allows_version_delete(old.package_version_id) then return old; end if;
    raise exception 'Section measurement snapshots are immutable';
  elsif tg_op='UPDATE' then
    raise exception 'Section measurement snapshots are immutable';
  end if;

  select status into v_status from public.test_package_versions where id=new.package_version_id;
  if v_status is null then raise exception 'Package Version not found'; end if;
  select package_version_id into v_section_version_id from public.test_sections where id=new.test_section_id;
  if v_section_version_id is distinct from new.package_version_id then
    raise exception 'Measurement snapshot Package Version must match its Test Section Package Version';
  end if;
  select profile_id into v_category_profile_id from public.cci_categories where id=new.cci_category_id;
  if v_category_profile_id is distinct from new.cci_profile_id then
    raise exception 'CCI Category must belong to the selected CCI Profile';
  end if;
  if v_status <> 'draft' and (new.supersedes_snapshot_id is null or new.override_reason is null) then
    raise exception 'Published measurement changes require an override snapshot';
  end if;
  return new;
end;
$$;
create or replace function public.ensure_cci_profile_is_draft()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_status text; v_profile_id uuid;
begin
  v_profile_id := case when tg_op='DELETE' then old.profile_id else new.profile_id end;
  if tg_op='DELETE' and private.catalog_reset_allows_profile_delete(v_profile_id) then return old; end if;
  select status into v_status from public.cci_profiles where id=v_profile_id;
  if v_status <> 'draft' then
    raise exception 'Active CCI Profiles are immutable; create a new profile version instead';
  end if;
  if tg_op in ('INSERT','UPDATE') then new.updated_at=now(); return new; end if;
  return old;
end;
$$;
revoke execute on function public.ensure_section_parent_version_is_draft() from public, anon, authenticated;
revoke execute on function public.ensure_item_parent_version_is_draft() from public, anon, authenticated;
revoke execute on function public.ensure_narration_parent_version_is_draft() from public, anon, authenticated;
revoke execute on function public.prevent_measurement_snapshot_rewrite() from public, anon, authenticated;
revoke execute on function public.ensure_cci_profile_is_draft() from public, anon, authenticated;
