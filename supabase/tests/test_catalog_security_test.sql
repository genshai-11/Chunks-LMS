begin;
select plan(8);

select ok((select qual like '%v.package_id = test_packages.id%' from pg_policies where schemaname='public' and tablename='test_packages' and policyname='test_packages_staff_read'), 'package staff-read policy correlates version to package row');
select is(has_function_privilege('anon','public.generate_test_item(uuid,uuid,text)','EXECUTE'), false, 'anon cannot execute item generation');
select is(has_function_privilege('anon','public.generate_narration(uuid,text,uuid,uuid,text,text)','EXECUTE'), false, 'anon cannot execute narration generation');
select is(has_function_privilege('anon','public.approve_generated_asset(uuid,text)','EXECUTE'), false, 'anon cannot approve generated assets');
select is(has_function_privilege('anon','public.calculate_learner_cpd_report(uuid,uuid,uuid)','EXECUTE'), false, 'anon cannot execute learner CPD summary');
select is(has_function_privilege('authenticated','public.get_learner_cpd_records(uuid,uuid,uuid)','EXECUTE'), false, 'authenticated cannot call raw CPD records directly');
select ok((select proconfig is not null from pg_proc where oid='public.calculate_learner_cpd_report(uuid,uuid,uuid)'::regprocedure), 'CPD summary has hardened function configuration');
select ok((select proconfig::text like '%search_path%' from pg_proc where oid='public.generate_narration(uuid,text,uuid,uuid,text,text)'::regprocedure), 'narration RPC has hardened search_path');

select * from finish();
rollback;
