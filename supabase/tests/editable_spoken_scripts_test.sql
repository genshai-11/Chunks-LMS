begin;
select plan(8);

select has_column('public', 'test_items', 'spoken_script_vi', 'Vietnamese exact spoken script override exists');
select has_column('public', 'test_items', 'spoken_script_en', 'English exact spoken script override exists');
select has_function('private', 'test_item_spoken_script', array['integer','text','text','text'], 'override-aware script helper exists');
select is(
  private.test_item_spoken_script(1, 'Xin chào.', 'vi', 'Câu 1. Xin chào.'),
  'Câu 1. Xin chào.',
  'Vietnamese override replaces default Số ordinal'
);
select is(
  private.test_item_spoken_script(2, 'Hello.', 'en', null),
  'Number 2. Hello.',
  'null override preserves deterministic English default'
);
select has_function('public', 'get_test_package_publication_readiness', array['uuid','text','text'], 'publication readiness RPC exists');
select has_function('public', 'publish_test_package_version', array['uuid','text','text'], 'guarded publication RPC exists');
select ok(
  pg_get_functiondef('public.start_standalone_test_run(uuid,text)'::regprocedure)
    like '%spoken_script_vi%',
  'runtime start freezes audio matching exact spoken overrides'
);

select * from finish();
rollback;
