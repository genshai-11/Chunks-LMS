-- Optional staff usernames for native Supabase Auth login.
-- Authentication still ends in auth.users; public.users.username is only a
-- case-normalized login identifier. Active staff_roles remain authoritative.

alter table public.users
  add column if not exists username text;

update public.users
set username = lower(btrim(username))
where username is not null;

-- This column is new on the current hosted schema, so collisions are not
-- expected. If a partially applied environment already populated it, stop
-- instead of silently choosing one account or nulling another account's login.
do $$
begin
  if exists (
    select lower(username)
    from public.users
    where username is not null
    group by lower(username)
    having count(*) > 1
  ) then
    raise exception 'Duplicate normalized staff usernames must be resolved before continuing';
  end if;

  if exists (
    select 1
    from public.users
    where username is not null
      and (
        char_length(username) not between 3 and 32
        or username !~ '^[a-z0-9][a-z0-9._-]{2,31}$'
      )
  ) then
    raise exception 'Invalid staff usernames must be resolved before continuing';
  end if;
end;
$$;

alter table public.users
  drop constraint if exists users_username_format_check;

alter table public.users
  add constraint users_username_format_check
  check (
    username is null
    or (
      username = lower(btrim(username))
      and char_length(username) between 3 and 32
      and username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'
    )
  );

-- The check constraint guarantees lowercase storage, so a direct unique index
-- is both case-insensitive in practice and usable by username equality lookups.
create unique index if not exists users_username_unique_idx
  on public.users (username)
  where username is not null;

comment on column public.users.username is
  'Optional normalized staff login identifier. It authenticates through the username-login Edge Function and never authorizes without an active staff_roles grant.';

-- Preserve the two historical local/demo aliases without deriving usernames
-- from real email addresses. Existing hosted users otherwise remain email-only
-- until an Admin assigns a username explicitly.
with aliases(email, username) as (
  values
    ('admin@example.com'::text, 'admin'::text),
    ('chunker@example.com'::text, 'chunker'::text)
)
update public.users as target
set username = aliases.username,
    updated_at = now()
from aliases
where target.username is null
  and lower(target.email) = aliases.email
  and exists (
    select 1
    from public.staff_roles role
    where role.user_id = target.id
      and role.active
      and role.role in ('admin', 'teacher')
  )
  and not exists (
    select 1
    from public.users occupied
    where occupied.username = aliases.username
  );

-- The username endpoint is intentionally unauthenticated, so it needs its own
-- server-side throttle. Only HMAC bucket hashes are stored; raw IP addresses
-- and usernames never enter this table.
create table if not exists public.username_login_rate_limits (
  bucket_hash text primary key
    check (bucket_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 1
    check (attempt_count > 0),
  updated_at timestamptz not null default now()
);

create index if not exists username_login_rate_limits_updated_at_idx
  on public.username_login_rate_limits (updated_at);

alter table public.username_login_rate_limits enable row level security;
revoke all on table public.username_login_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.username_login_rate_limits to service_role;

comment on table public.username_login_rate_limits is
  'Internal five-minute throttle buckets for username-login. Stores HMAC hashes only and has no client RLS policies.';

create or replace function public.consume_username_login_attempt(
  p_bucket_hash text,
  p_attempt_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_window_cutoff timestamptz := statement_timestamp() - interval '5 minutes';
  v_attempt_count integer;
begin
  if p_bucket_hash !~ '^[a-f0-9]{64}$'
     or p_attempt_limit < 1
     or p_attempt_limit > 100 then
    return false;
  end if;

  insert into public.username_login_rate_limits as existing (
    bucket_hash,
    window_started_at,
    attempt_count,
    updated_at
  )
  values (p_bucket_hash, v_now, 1, v_now)
  on conflict (bucket_hash) do update
  set window_started_at = case
        when existing.window_started_at <= v_window_cutoff then v_now
        else existing.window_started_at
      end,
      attempt_count = case
        when existing.window_started_at <= v_window_cutoff then 1
        else least(existing.attempt_count + 1, p_attempt_limit + 1)
      end,
      updated_at = v_now
  returning attempt_count into v_attempt_count;

  delete from public.username_login_rate_limits
  where updated_at < v_now - interval '1 day';

  return v_attempt_count <= p_attempt_limit;
end;
$$;

revoke all on function public.consume_username_login_attempt(text, integer)
  from public, anon, authenticated;
grant execute on function public.consume_username_login_attempt(text, integer)
  to service_role;;
