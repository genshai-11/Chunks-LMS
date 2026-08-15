-- Repair native learner-link functions surfaced by production plpgsql lint.
create or replace function public.learner_access_token_hash(p_url_token text)
returns text
language sql
immutable
set search_path = pg_catalog, extensions
as $$
  select encode(extensions.digest(p_url_token, 'sha256'), 'hex');
$$;
create or replace function public.issue_learner_access_token(
  p_learner_user_id uuid,
  p_class_id uuid,
  p_ttl_seconds integer default 2592000
)
returns table (token_id uuid, url_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_token_id uuid := gen_random_uuid();
  v_secret text := encode(extensions.gen_random_bytes(32), 'base64');
  v_url_token text;
  v_expires_at timestamptz;
  v_actor uuid := public.current_staff_user_id();
begin
  if v_actor is null then raise exception 'Staff sign-in required'; end if;
  if p_ttl_seconds is null or p_ttl_seconds < 300 or p_ttl_seconds > 7776000 then
    raise exception 'TTL must be between 5 minutes and 90 days';
  end if;
  if not public.staff_can_issue_learner_access(p_learner_user_id,p_class_id) then
    raise exception 'Not authorized to issue learner access for this scope';
  end if;
  if exists(select 1 from public.users u where u.id=p_learner_user_id and u.auth_user_id is not null) then
    raise exception 'Learner access must not be issued to a Supabase Auth account';
  end if;

  v_url_token := 'lat_' || replace(v_token_id::text,'-','') || '_' || replace(replace(replace(v_secret,'+','-'),'/','_'),'=','');
  v_expires_at := now() + make_interval(secs => p_ttl_seconds);
  insert into public.learner_access_tokens(id,token_hash,learner_user_id,class_id,issued_by_user_id,expires_at)
  values(v_token_id,public.learner_access_token_hash(v_url_token),p_learner_user_id,p_class_id,v_actor,v_expires_at);
  return query select v_token_id,v_url_token,v_expires_at;
end;
$$;
create or replace function public.verify_learner_access(p_url_token text)
returns table (
  token_id uuid,
  learner_user_id uuid,
  class_id uuid,
  expires_at timestamptz,
  learner_display_name text,
  learner_email text,
  class_name text
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  return query
  with eligible as (
    select lat.id,lat.learner_user_id,lat.class_id,lat.expires_at,
      learner.display_name,learner.email,cl.name as class_name
    from public.learner_access_tokens lat
    join public.users learner on learner.id=lat.learner_user_id
    left join public.classes cl on cl.id=lat.class_id
    where lat.token_hash=public.learner_access_token_hash(p_url_token)
      and lat.revoked_at is null
      and lat.expires_at > now()
      and learner.account_status='active'
      and learner.auth_user_id is null
    for update of lat
  ), touched as (
    update public.learner_access_tokens lat
    set last_used_at=now()
    from eligible e
    where lat.id=e.id
    returning lat.id
  )
  select e.id,e.learner_user_id,e.class_id,e.expires_at,e.display_name,e.email,e.class_name
  from eligible e join touched t on t.id=e.id;
end;
$$;
alter function public.learner_access_snapshot(text)
  set search_path = pg_catalog, public, extensions;
alter function public.stage_live_test_v2_csv_rows(text,jsonb)
  set search_path = pg_catalog, public, extensions;
alter function public.live_test_v2_source_row_checksum(public.live_test_items)
  set search_path = pg_catalog, public, extensions;
alter function public.preview_live_test_v2_migration(text)
  set search_path = pg_catalog, public, extensions;
alter function public.apply_live_test_v2_catalog_backfill(text,text,boolean)
  set search_path = pg_catalog, public, extensions;
