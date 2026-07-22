begin;
select plan(5);

select has_function('public','handle_auth_user_created',array[]::text[],'native Auth provisioning trigger function exists');
select ok((select prosecdef from pg_proc where oid='public.handle_auth_user_created()'::regprocedure),'Auth provisioning is SECURITY DEFINER');
select ok((select proconfig::text like '%pg_catalog, public, extensions%' from pg_proc where oid='public.handle_auth_user_created()'::regprocedure),'Auth provisioning fixes search_path');
select ok((select position('organization_memberships' in pg_get_functiondef('public.handle_auth_user_created()'::regprocedure)) > 0),'roles derive from existing database memberships');
select ok((select position('@gmail.com' in pg_get_functiondef('public.handle_auth_user_created()'::regprocedure)) = 0),'provisioning contains no hardcoded staff emails');

select * from finish();
rollback;
