begin;
do $$ begin
  if not exists (select 1 from public.test_packages where id='ca9b8acf-fae4-47bc-b9bd-0e663facae56'::uuid and slug='red-test') then raise exception 'Expected RED-TEST package/slug not found'; end if;
  if exists (select 1 from public.test_packages where slug='red-test-56v' and id<>'ca9b8acf-fae4-47bc-b9bd-0e663facae56'::uuid) then raise exception 'Slug red-test-56v is already used by another package'; end if;
end $$;
update public.test_packages set title='RED-TEST-56V',slug='red-test-56v',source_metadata=source_metadata||jsonb_build_object('renamedAt','2026-08-01T15:55:00Z','previousTitle',title,'previousSlug',slug),updated_at=now() where id='ca9b8acf-fae4-47bc-b9bd-0e663facae56'::uuid;
commit;;
