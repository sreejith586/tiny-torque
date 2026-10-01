-- pgTAP for catalog + ai_scan_jobs (MV-S3-01, D-013). Verified catalogue is public; proposals are
-- own-only; admins write; scan jobs are owner/admin-read; scan-quota function. Run via CI's pgTAP job.

begin;
select plan(11);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, display_name, account_type, handle, role, plan) values
  ('00000000-0000-0000-0000-00000000000a', 'Owner', 'individual', 'cat_owner', 'user', 'free'),
  ('00000000-0000-0000-0000-00000000000b', 'Stranger', 'individual', 'cat_stranger', 'user', 'pro'),
  ('00000000-0000-0000-0000-00000000000c', 'Admin', 'individual', 'cat_admin', 'admin', 'free');

-- a verified brand (seeded) + one proposed by the owner
insert into public.catalog_brands (id, name, slug, status, proposed_by) values
  ('30000000-0000-0000-0000-0000000000b1', 'ProposedCo', 'proposedco', 'proposed', '00000000-0000-0000-0000-00000000000a');

insert into public.catalog_models (id, brand_id, name, status, proposed_by) values
  ('30000000-0000-0000-0000-0000000000d1',
   (select id from public.catalog_brands where name = 'Hot Wheels'), 'Skyline GT-R', 'verified', null),
  ('30000000-0000-0000-0000-0000000000d2',
   '30000000-0000-0000-0000-0000000000b1', 'Mystery Car', 'proposed', '00000000-0000-0000-0000-00000000000a');

insert into public.ai_scan_jobs (id, user_id, kind, status) values
  ('30000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a', 'single', 'done'),
  ('30000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000000b', 'single', 'done');

create schema if not exists tests;
create or replace function tests.authenticate_as(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end; $$;
create or replace function tests.authenticate_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end; $$;
create or replace function tests.clear_authentication() returns void language plpgsql as $$
begin perform set_config('role', 'supabase_admin', true); end; $$;
create or replace function tests.exec_and_count(p_sql text) returns integer language plpgsql as $$
declare v int; begin execute p_sql; get diagnostics v = row_count; return v; end; $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- anon: sees verified catalogue only
select tests.authenticate_as_anon();
select ok((select count(*) from public.catalog_brands where status='verified') >= 16, 'anon reads verified brands');
select is((select count(*)::int from public.catalog_brands where name='ProposedCo'), 0, 'anon cannot read a proposed brand');
select is((select count(*)::int from public.catalog_models where id='30000000-0000-0000-0000-0000000000d1'), 1, 'anon reads a verified model');
select is((select count(*)::int from public.catalog_models where id='30000000-0000-0000-0000-0000000000d2'), 0, 'anon cannot read a proposed model');

-- owner: sees their own proposal
select tests.clear_authentication();
select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.catalog_brands where name='ProposedCo'), 1, 'owner reads their own proposed brand');
select throws_ok($$insert into public.catalog_brands (name, slug) values ('Nope','nope')$$, '42501', null, 'non-admin cannot write brands');

-- stranger: cannot see owner's proposal; owns their own scan job only
select tests.clear_authentication();
select tests.authenticate_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.catalog_brands where name='ProposedCo'), 0, 'stranger cannot read other users proposal');
select is((select count(*)::int from public.ai_scan_jobs), 1, 'stranger sees only their own scan job');

-- admin: writes + reads all
select tests.clear_authentication();
select tests.authenticate_as('00000000-0000-0000-0000-00000000000c');
select is(tests.exec_and_count($$update public.catalog_brands set status='verified' where name='ProposedCo'$$), 1, 'admin can write brands');
select is((select count(*)::int from public.ai_scan_jobs), 2, 'admin reads all scan jobs');

-- scan quota: free base is 10, minus the one done job this period = 9
select tests.clear_authentication();
select is(public.entitlement_scan_quota('00000000-0000-0000-0000-00000000000a'), 9, 'free scan quota = base 10 − 1 done job');

select * from finish();
rollback;
