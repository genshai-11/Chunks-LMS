-- Native Supabase Auth provisioning: link by email while preserving the stable
-- domain UUID, then copy only pre-existing database membership grants.
-- New unmatched signups remain no-role and cannot enter staff workspaces.
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_user_id uuid;
  v_email text;
begin
  v_email := lower(trim(new.email));
  if v_email is null or v_email = '' then
    return new;
  end if;

  select u.id into v_user_id
  from public.users u
  where lower(u.email) = v_email
  order by u.created_at
  limit 1;

  if v_user_id is null then
    insert into public.users (
      email, display_name, account_status, allow_multi_class, auth_user_id,
      clerk_user_id, legacy_clerk_user_id, created_at, updated_at
    ) values (
      new.email,
      coalesce(
        nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
        nullif(trim(new.raw_user_meta_data->>'name'), ''),
        new.email
      ),
      'active', false, new.id, null, null, now(), now()
    )
    returning id into v_user_id;
  else
    update public.users
    set auth_user_id = new.id,
        updated_at = now()
    where id = v_user_id;
  end if;

  insert into public.staff_roles (user_id, role, active, created_at, updated_at)
  select v_user_id, membership.role, true, now(), now()
  from public.organization_memberships membership
  where membership.user_id = v_user_id
    and membership.role in ('admin', 'teacher')
  on conflict (user_id, role) do update
  set active = true,
      updated_at = excluded.updated_at,
      revoked_at = null;

  return new;
end;
$$;
revoke all on function public.handle_auth_user_created() from public, anon, authenticated;
comment on function public.handle_auth_user_created() is
  'Links native Auth to a stable domain User and activates only pre-provisioned database staff membership roles; unmatched signups remain no-role.';
