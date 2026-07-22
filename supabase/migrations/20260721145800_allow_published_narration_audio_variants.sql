-- Published Package Versions are immutable for content, but narration audio assets/variants
-- are operational resources that may be generated and reviewed after publication.
-- Allow generated narration inserts and review-status updates while keeping content fields frozen.

create or replace function public.ensure_narration_parent_version_is_draft()
returns trigger
language plpgsql
as $$
declare
  v_package_version_id uuid;
  v_status text;
begin
  v_package_version_id := case when tg_op = 'DELETE' then old.package_version_id else new.package_version_id end;

  select status into v_status
  from public.test_package_versions
  where id = v_package_version_id;

  if v_status is null then
    raise exception 'Package Version not found';
  end if;

  if v_status = 'draft' then
    if tg_op in ('INSERT', 'UPDATE') then
      new.updated_at = now();
      return new;
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.approval_status = 'generated'
      and new.audio_asset_id is not null
      and new.generation_job_id is not null
      and new.approved_at is null
      and new.approved_by_user_id is null
    then
      new.updated_at = now();
      return new;
    end if;

    raise exception 'Published Package Versions are immutable';
  end if;

  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - array['approval_status','approved_by_user_id','approved_at','provider_metadata','updated_at'])
       =
       (to_jsonb(old) - array['approval_status','approved_by_user_id','approved_at','provider_metadata','updated_at'])
       and old.approval_status in ('generated','approved','rejected')
       and new.approval_status in ('generated','approved','rejected','archived')
       and new.audio_asset_id is not null
    then
      if new.approval_status = 'approved' then
        if new.approved_at is null or new.approved_by_user_id is null then
          raise exception 'Approved narration requires approved_at and approved_by_user_id';
        end if;
      else
        new.approved_at = null;
        new.approved_by_user_id = null;
      end if;

      new.updated_at = now();
      return new;
    end if;

    raise exception 'Published Package Versions are immutable';
  end if;

  raise exception 'Published Package Versions are immutable';
end;
$$;

drop trigger if exists trg_ensure_narration_parent_version_is_draft on public.narration_variants;
create trigger trg_ensure_narration_parent_version_is_draft
before insert or update or delete on public.narration_variants
for each row execute function public.ensure_narration_parent_version_is_draft();
