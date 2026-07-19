-- Migration: 20260719071000_auth_trigger_google_oauth_provisioning
-- Automatically provisions public.users and grants admin/teacher roles 
-- to designated emails (le.ntmkh@gmail.com and phamduybach90@gmail.com) upon authentication.

SET search_path TO public, extensions;
-- Create the trigger function
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_email text;
begin
  v_email := lower(new.email);
  if v_email is null then
    return new;
  end if;
  
  -- Check if user already exists by email
  select id into v_user_id from public.users where lower(email) = v_email;
  
  if v_user_id is not null then
    -- Update existing user with auth_user_id
    update public.users
    set auth_user_id = new.id,
        updated_at = now()
    where id = v_user_id;
  else
    -- Insert new user
    v_user_id := gen_random_uuid();
    insert into public.users (
      id,
      email,
      display_name,
      account_status,
      allow_multi_class,
      auth_user_id,
      created_at,
      updated_at
    )
    values (
      v_user_id,
      new.email,
      coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', new.email),
      'active',
      false,
      new.id,
      now(),
      now()
    );
  end if;

  -- Auto-grant roles for specified admin emails
  if v_email in ('le.ntmkh@gmail.com', 'phamduybach90@gmail.com') then
    -- Admin role
    insert into public.staff_roles (user_id, role, active, created_at, updated_at)
    values (v_user_id, 'admin', true, now(), now())
    on conflict (user_id, role) do update
    set active = true, updated_at = now();

    -- Teacher role
    insert into public.staff_roles (user_id, role, active, created_at, updated_at)
    values (v_user_id, 'teacher', true, now(), now())
    on conflict (user_id, role) do update
    set active = true, updated_at = now();
  end if;

  return new;
end;
$$;
-- Setup the trigger on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_created();
-- Backfill: Provision current user row and roles for phamduybach90@gmail.com if they already logged in or exist in auth.users
do $$
declare
  v_auth_id uuid;
  v_user_id uuid;
begin
  -- If user exists in auth.users, run the handler manually
  select id into v_auth_id from auth.users where lower(email) = 'phamduybach90@gmail.com';
  if v_auth_id is not null then
    -- Retrieve auth user record and insert/link
    perform public.handle_auth_user_created()
    from auth.users
    where id = v_auth_id;
  else
    -- If they don't exist in auth.users yet, pre-provision them in public.users and staff_roles
    select id into v_user_id from public.users where lower(email) = 'phamduybach90@gmail.com';
    if v_user_id is null then
      v_user_id := gen_random_uuid();
      insert into public.users (
        id,
        email,
        display_name,
        account_status,
        allow_multi_class,
        auth_user_id,
        created_at,
        updated_at
      )
      values (
        v_user_id,
        'phamduybach90@gmail.com',
        'phamduybach90@gmail.com',
        'active',
        false,
        null,
        now(),
        now()
      );
    end if;

    -- Grant roles
    insert into public.staff_roles (user_id, role, active, created_at, updated_at)
    values (v_user_id, 'admin', true, now(), now())
    on conflict (user_id, role) do update
    set active = true, updated_at = now();

    insert into public.staff_roles (user_id, role, active, created_at, updated_at)
    values (v_user_id, 'teacher', true, now(), now())
    on conflict (user_id, role) do update
    set active = true, updated_at = now();
  end if;
end;
$$;
