begin;
select plan(6);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
values ('81000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','replacement-admin@example.com',crypt('password',gen_salt('bf')),now(),now(),now(),'{}','{}');
insert into public.organizations(id,name) values ('82000000-0000-4000-8000-000000000001','Replacement Org');
insert into public.users(id,auth_user_id,legacy_clerk_user_id,display_name,email,account_status)
values ('83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','replacement-admin','Admin','replacement-admin@example.com','active');
insert into public.staff_roles(user_id,role,active) values ('83000000-0000-4000-8000-000000000001','admin',true);
insert into public.organization_memberships(organization_id,user_id,role) values ('82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','admin');

set local role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);

with cci as (
  select jsonb_agg(jsonb_build_object('sessionOrder',n,'sourceCciId','cci-'||lpad(n::text,3,'0'),'name','CCI '||n,'ampe',case when n<3 then 2 when n<5 then 4 when n<7 then 6 else 8 end,'description','D','category',null) order by n) value from generate_series(1,8) n
), sessions as (
  select jsonb_agg(jsonb_build_object('sessionOrder',n,'name','Test '||lpad(n::text,2,'0'),'description','D','sourceCciId','cci-'||lpad(n::text,3,'0'),'targetCvrOhm',n*2+1,'introTextVi','Intro','introTextEn','Intro','items',(select jsonb_agg(jsonb_build_object('itemOrder',i,'sourceItemId','Number '||i,'sourceMaterial','Day','sourceCciId','cci-'||lpad(n::text,3,'0'),'sourceCvrId',n*2+1,'termVi','Từ','termEn','Word','promptVi','Câu','promptEn','Sentence') order by i) from generate_series(1,10) i)) order by n) value from generate_series(1,8) n
), manifest as (
  select jsonb_build_object('source',jsonb_build_object('filename','Chunks Resource.xlsx','sha256',repeat('a',64),'sheets',jsonb_build_array('Chunks-resource - CVR_new','Package-test','CCI')),'package',jsonb_build_object('sourcePackageId','Pre-test','title','Pre-test','description','D','versionLabel','draft-v1'),'cciDefinitions',cci.value,'sessions',sessions.value,'issues','[]'::jsonb) value from cci,sessions
), preview as (
  select public.preview_test_catalog_replacement(repeat('a',64),value) value from manifest
)
select is(value->>'remoteMutation','false','preview performs no destructive mutation') from preview;
select is((select count(*)::int from public.test_catalog_import_runs),1,'preview records one durable import audit row');
select is((select status from public.test_catalog_import_runs limit 1),'previewed','import run remains previewed before confirmation');
select is((select preview_counts from public.test_catalog_import_runs limit 1),private.obsolete_test_catalog_counts(private.obsolete_test_catalog_scope()),'preview stores current exact counts');
select throws_ok($$select public.apply_test_catalog_replacement((select id from public.test_catalog_import_runs limit 1),'wrong-token')$$,'Confirmation token mismatch','wrong token aborts apply');
select is((select count(*)::int from public.organizations where id='82000000-0000-4000-8000-000000000001'),1,'failed confirmation never deletes non-test organization');

select * from finish();
rollback;
