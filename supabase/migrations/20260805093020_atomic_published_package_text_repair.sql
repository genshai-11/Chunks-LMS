create table if not exists public.package_version_text_repairs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  package_version_id uuid not null references public.test_package_versions(id) on delete restrict,
  reason text not null check (length(trim(reason)) >= 8),
  status text not null check (status in ('running','completed')),
  repairs jsonb not null default '[]'::jsonb check (jsonb_typeof(repairs) = 'array'),
  requested_by_user_id uuid references public.users(id),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.package_version_text_repairs enable row level security;
drop policy if exists package_version_text_repairs_admin_read on public.package_version_text_repairs;
create policy package_version_text_repairs_admin_read on public.package_version_text_repairs for select to authenticated using ((select public.current_staff_is_admin()));
create or replace function private.active_package_text_repair_allows_draft(p_version_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public, private as $$
  select exists (select 1 from public.package_version_text_repairs r where r.id::text = nullif(current_setting('app.package_text_repair_id', true), '') and r.package_version_id = p_version_id and r.status = 'running')
$$;
revoke execute on function private.active_package_text_repair_allows_draft(uuid) from public, anon, authenticated;
grant execute on function private.active_package_text_repair_allows_draft(uuid) to service_role;
create or replace function public.freeze_published_package_version()
returns trigger language plpgsql set search_path = pg_catalog, public, private as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'draft' or private.catalog_reset_allows_version_delete(old.id) then return old; end if;
    raise exception 'Published Package Versions are immutable';
  end if;
  if old.status <> 'draft' then
    if old.status = 'published' and new.status = 'draft' and private.active_package_text_repair_allows_draft(old.id)
      and new.package_id is not distinct from old.package_id and new.version_label is not distinct from old.version_label
      and new.draft_of_version_id is not distinct from old.draft_of_version_id and new.snapshot_hash is not distinct from old.snapshot_hash
      and new.source_metadata is not distinct from old.source_metadata and new.created_by_user_id is not distinct from old.created_by_user_id
      and new.published_by_user_id is not distinct from old.published_by_user_id and new.created_at is not distinct from old.created_at
      and new.published_at is not distinct from old.published_at and new.archived_at is not distinct from old.archived_at
    then new.updated_at = now(); return new; end if;
    if old.status = 'published' and new.status = 'archived'
      and new.package_id is not distinct from old.package_id and new.version_label is not distinct from old.version_label
      and new.draft_of_version_id is not distinct from old.draft_of_version_id and new.snapshot_hash is not distinct from old.snapshot_hash
      and new.source_metadata is not distinct from old.source_metadata and new.created_by_user_id is not distinct from old.created_by_user_id
      and new.created_at is not distinct from old.created_at and new.published_at is not distinct from old.published_at
    then new.archived_at = coalesce(new.archived_at, now()); new.updated_at = now(); return new; end if;
    raise exception 'Published Package Versions are immutable';
  end if;
  if new.status = 'published' then new.published_at = coalesce(new.published_at, now()); end if;
  if new.status = 'archived' then new.archived_at = coalesce(new.archived_at, now()); end if;
  new.updated_at = now(); return new;
end;
$$;
create or replace function public.repair_published_test_item_texts(p_package_version_id uuid,p_repairs jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare
  v_repair_id uuid := gen_random_uuid(); v_org_id uuid; v_actor uuid := public.current_staff_user_id(); v_status text;
  v_patch jsonb; v_item public.test_items%rowtype; v_audit jsonb := '[]'::jsonb; v_count int := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user <> 'postgres' then raise exception 'Text repair requires service_role' using errcode = '42501'; end if;
  if jsonb_typeof(p_repairs) <> 'array' or jsonb_array_length(p_repairs) = 0 then raise exception 'p_repairs must be a non-empty JSON array'; end if;
  if length(trim(coalesce(p_reason,''))) < 8 then raise exception 'A repair reason of at least 8 characters is required'; end if;
  select p.organization_id, v.status into v_org_id, v_status from public.test_package_versions v join public.test_packages p on p.id = v.package_id where v.id = p_package_version_id for update of v;
  if v_org_id is null then raise exception 'Package Version not found'; end if;
  if v_status <> 'published' then raise exception 'Package Version must be published'; end if;
  insert into public.package_version_text_repairs(id,organization_id,package_version_id,reason,status,requested_by_user_id) values(v_repair_id,v_org_id,p_package_version_id,trim(p_reason),'running',v_actor);
  perform set_config('app.package_text_repair_id', v_repair_id::text, true);
  update public.test_package_versions set status = 'draft' where id = p_package_version_id;
  for v_patch in select value from jsonb_array_elements(p_repairs) loop
    if not (v_patch ? 'sectionOrder' and v_patch ? 'itemOrder' and v_patch ? 'textVi') then raise exception 'Each patch requires sectionOrder, itemOrder, and textVi'; end if;
    select i.* into v_item from public.test_items i join public.test_sections s on s.id = i.section_id where i.package_version_id = p_package_version_id and s.section_order = (v_patch->>'sectionOrder')::int and i.item_order = (v_patch->>'itemOrder')::int for update;
    if v_item.id is null then raise exception 'Item not found for section % item %', v_patch->>'sectionOrder', v_patch->>'itemOrder'; end if;
    v_audit := v_audit || jsonb_build_array(jsonb_build_object('itemId',v_item.id,'sectionOrder',(v_patch->>'sectionOrder')::int,'itemOrder',(v_patch->>'itemOrder')::int,'before',jsonb_build_object('termVi',v_item.term_vi,'promptVi',v_item.prompt_vi,'spokenScriptVi',v_item.spoken_script_vi),'after',jsonb_build_object('termVi',v_patch->>'textVi','promptVi',v_patch->>'textVi','spokenScriptVi',v_patch->>'textVi')));
    update public.test_items set term_vi=v_patch->>'textVi',prompt_vi=v_patch->>'textVi',spoken_script_vi=v_patch->>'textVi',source_metadata=source_metadata||jsonb_build_object('lastTextRepair',jsonb_build_object('repairId',v_repair_id,'reason',trim(p_reason),'repairedAt',now())) where id=v_item.id;
    v_count:=v_count+1;
  end loop;
  update public.test_package_versions set source_metadata=source_metadata||jsonb_build_object('lastTextRepairId',v_repair_id,'lastTextRepairAt',now(),'lastTextRepairReason',trim(p_reason)),status='published' where id=p_package_version_id;
  update public.package_version_text_repairs set status='completed',repairs=v_audit,completed_at=now() where id=v_repair_id;
  perform set_config('app.package_text_repair_id','',true);
  return jsonb_build_object('repairId',v_repair_id,'packageVersionId',p_package_version_id,'status','published','repairedItems',v_count);
end;
$$;
revoke execute on function public.repair_published_test_item_texts(uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.repair_published_test_item_texts(uuid,jsonb,text) to service_role;
comment on function public.repair_published_test_item_texts(uuid,jsonb,text) is 'Atomically repairs VI text fields on a published package: audited published→draft→published in one transaction. Existing standalone_test_run_items remain frozen.';;
