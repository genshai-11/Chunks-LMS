begin;
select plan(13);

select has_column(
  'public',
  'users',
  'username',
  'staff username column exists'
);

select ok(
  (
    select is_nullable = 'YES'
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'username'
  ),
  'staff username remains optional'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'users_username_format_check'
      and conrelid = 'public.users'::regclass
  ),
  'staff username format constraint exists'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'users'
      and indexname = 'users_username_unique_idx'
      and indexdef like 'CREATE UNIQUE INDEX%'
  ),
  'normalized staff username has a unique lookup index'
);

select has_table(
  'public',
  'username_login_rate_limits',
  'username login throttle table exists'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.username_login_rate_limits'::regclass
  ),
  'username login throttle table has RLS enabled'
);

select ok(
  not has_table_privilege('anon', 'public.username_login_rate_limits', 'SELECT'),
  'anonymous clients cannot read throttle buckets'
);

select has_function(
  'public',
  'consume_username_login_attempt',
  array['text', 'integer'],
  'username login throttle function exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.consume_username_login_attempt(text, integer)',
    'EXECUTE'
  ),
  'anonymous clients cannot call the throttle function directly'
);

select ok(
  (
    select prosecdef
    from pg_proc
    where oid = 'public.consume_username_login_attempt(text, integer)'::regprocedure
  ),
  'username login throttle function is SECURITY DEFINER'
);

delete from public.username_login_rate_limits
where bucket_hash = repeat('f', 64);

select is(
  public.consume_username_login_attempt(repeat('f', 64), 1),
  true,
  'first attempt in a throttle window is allowed'
);

select is(
  public.consume_username_login_attempt(repeat('f', 64), 1),
  false,
  'attempts over the bucket limit are rejected'
);

select is(
  public.consume_username_login_attempt('raw-identifier', 10),
  false,
  'non-HMAC bucket values fail closed'
);

select * from finish();
rollback;
