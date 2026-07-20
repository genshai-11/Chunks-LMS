begin;
select plan(8);

select has_function(
  'private',
  'narration_spoken_source_hash',
  array['text', 'text', 'text'],
  'current narration source hash helper exists'
);
select has_function(
  'private',
  'test_item_spoken_script',
  array['integer', 'text', 'text'],
  'language-aware item script helper exists'
);
select is(
  private.test_item_spoken_script(2, '  Xin   chào. ', 'vi'),
  'Số 2. Xin chào.',
  'Vietnamese item script uses Số ordinal and normalized whitespace'
);
select is(
  private.test_item_spoken_script(2, '  Hello. ', 'en'),
  'Number 2. Hello.',
  'English item script uses Number ordinal and normalized whitespace'
);
select is(
  private.narration_spoken_source_hash('Số 2.  Xin chào.', 'vi', 'alloy'),
  'sha256:67c544625e8019270d9fa17b10439e20441de959fbcf05d704628d88506d4c42',
  'SQL source hash matches the web and Edge SHA-256 contract'
);
select isnt(
  private.narration_spoken_source_hash('Number 2. Hello.', 'en', 'alloy'),
  private.narration_spoken_source_hash('Number 2. Hello.', 'en', 'verse'),
  'voice changes invalidate narration source hash'
);
select ok(
  pg_get_functiondef('public.prepare_standalone_test_run(uuid,uuid,text,text)'::regprocedure)
    like '%source_text_hash = private.narration_spoken_source_hash%',
  'prepare gate counts only current-hash approved narration'
);
select ok(
  pg_get_functiondef('public.start_standalone_test_run(uuid,text)'::regprocedure)
    like '%source_text_hash = private.narration_spoken_source_hash%',
  'start gate freezes only current-hash approved narration'
);

select * from finish();
rollback;
