-- pgTAP for catalogue car specs (MV-W08-prep, F-25, D-075, D-008 proposed→verified, D-021).
-- The shape validator + CHECK, the guard trigger (specs change only inside the RPCs), who may
-- propose / verify, invalid shapes rejected on both paths, "verified wins over proposed", and the
-- events each path emits. Run via CI's pgTAP job.

begin;
select plan(26);

insert into auth.users (id) values
  ('80000000-0000-0000-0000-00000000000a'),
  ('80000000-0000-0000-0000-00000000000b'),
  ('80000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, display_name, account_type, handle, role, plan) values
  ('80000000-0000-0000-0000-00000000000a', 'Member',  'individual', 'sp_member',  'user',  'free'),
  ('80000000-0000-0000-0000-00000000000b', 'Other',   'individual', 'sp_other',   'user',  'free'),
  ('80000000-0000-0000-0000-00000000000c', 'Admin',   'individual', 'sp_admin',   'admin', 'free');

insert into public.catalog_models (id, brand_id, name, status, proposed_by) values
  ('80000000-0000-0000-0000-0000000000d1',
   (select id from public.catalog_brands where name = 'Hot Wheels'), 'Nissan Skyline GT-R R34', 'verified', null),
  ('80000000-0000-0000-0000-0000000000d2',
   (select id from public.catalog_brands where name = 'Hot Wheels'), 'Twin Mill', 'verified', null),
  ('80000000-0000-0000-0000-0000000000d3',
   (select id from public.catalog_brands where name = 'Hot Wheels'), 'Member proposal', 'proposed', '80000000-0000-0000-0000-00000000000a');

create schema if not exists tests;
create or replace function tests.authenticate_as(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end; $$;
create or replace function tests.authenticate_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end; $$;
create or replace function tests.authenticate_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end; $$;
create or replace function tests.clear_authentication() returns void language plpgsql as $$
begin
  perform set_config('role', 'supabase_admin', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end; $$;
grant usage on schema tests to anon, authenticated, service_role;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- ---------- shape validator ----------
select ok(public.catalog_specs_valid('{}'::jsonb), 'empty object is a valid (unknown) spec');
select ok(public.catalog_specs_valid('{"power_kw": 206, "torque_nm": 392, "weight_kg": 1560, "zero_to_100_s": 4.9, "top_speed_kmh": 250, "drivetrain": "awd", "drag_cd": 0.34, "model_year": 1999}'::jsonb),
  'a full R34 spec passes');
select ok(not public.catalog_specs_valid('{"horsepower": 300}'::jsonb), 'unknown key is rejected');
select ok(not public.catalog_specs_valid('{"drivetrain": "4wd"}'::jsonb), 'drivetrain outside fwd/rwd/awd is rejected');
select ok(not public.catalog_specs_valid('{"power_kw": "206"}'::jsonb), 'a numeric field given as a string is rejected');
select ok(not public.catalog_specs_valid('{"weight_kg": 12}'::jsonb), 'out-of-range weight is rejected');
select ok(not public.catalog_specs_valid('{"model_year": 1999.5}'::jsonb), 'non-integer model_year is rejected');
select ok(not public.catalog_specs_valid('[1,2]'::jsonb), 'a non-object is rejected');

-- the CHECK constraint uses the same function (admin, GUC on so the guard trigger lets it through)
select tests.clear_authentication();
select set_config('mv.catalog_specs_rpc', 'on', true);
select throws_ok(
  $$update public.catalog_models set specs = '{"top_speed_kmh": 9999}'::jsonb where id = '80000000-0000-0000-0000-0000000000d1'$$,
  '23514', null, 'CHECK constraint rejects an out-of-range value even for a direct admin write');
select set_config('mv.catalog_specs_rpc', 'off', true);

-- ---------- guard: direct writes to the specs columns are refused ----------
select throws_ok(
  $$update public.catalog_models set specs = '{"power_kw": 100}'::jsonb where id = '80000000-0000-0000-0000-0000000000d1'$$,
  'P0001', 'specs_rpc_only', 'specs cannot be set by a direct update, even as admin — RPC only');
select lives_ok(
  $$update public.catalog_models set series = 'Fast & Furious' where id = '80000000-0000-0000-0000-0000000000d1'$$,
  'other columns still update normally (the guard only watches the specs columns)');

-- ---------- who may call what ----------
select tests.authenticate_anon();
select throws_ok(
  $$select public.propose_catalog_specs('80000000-0000-0000-0000-0000000000d1', '{"power_kw": 206}'::jsonb, 'wiki')$$,
  '42501', null, 'anon cannot propose specs');
select tests.clear_authentication();
select tests.authenticate_as('80000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$select public.verify_catalog_specs('80000000-0000-0000-0000-0000000000d1', '{"power_kw": 206}'::jsonb)$$,
  '42501', null, 'a non-admin cannot verify specs');
select throws_ok(
  $$select public.propose_catalog_specs('80000000-0000-0000-0000-0000000000d1', '{"horsepower": 300}'::jsonb, 'wiki')$$,
  '22023', 'specs_invalid', 'propose rejects an invalid shape');
select throws_ok(
  $$select public.propose_catalog_specs('80000000-0000-0000-0000-0000000000d1', '{}'::jsonb, 'wiki')$$,
  '22023', 'specs_invalid', 'propose rejects an empty proposal');
select tests.clear_authentication();
select tests.authenticate_as('80000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$select public.propose_catalog_specs('80000000-0000-0000-0000-0000000000d3', '{"power_kw": 100}'::jsonb, 'member')$$,
  'P0002', 'model_not_found', 'a member cannot propose specs on someone else''s unverified model proposal');

-- ---------- member proposal lands as a proposal ----------
select tests.clear_authentication();
select tests.authenticate_as('80000000-0000-0000-0000-00000000000a');
select is(
  (select specs_verified_at from public.propose_catalog_specs(
     '80000000-0000-0000-0000-0000000000d1',
     '{"power_kw": 206, "weight_kg": 1560, "drivetrain": "awd"}'::jsonb, 'wiki')),
  null, 'propose stores the specs with no verified_at (proposed state)');
select tests.clear_authentication();
select is(
  (select specs_proposed_by from public.catalog_models where id = '80000000-0000-0000-0000-0000000000d1'),
  '80000000-0000-0000-0000-00000000000a', 'specs_proposed_by is the proposer');
select is(
  (select count(*)::int from public.domain_events where type = 'catalog.specs_proposed'
     and entity = 'catalog_model' and entity_id = '80000000-0000-0000-0000-0000000000d1'
     and actor_id = '80000000-0000-0000-0000-00000000000a'),
  1, 'catalog.specs_proposed is emitted');

-- the AI scan (service role) can propose too; proposed_by stays null, source says ai
select tests.authenticate_service();
select is(
  (select specs_proposed_by from public.propose_catalog_specs(
     '80000000-0000-0000-0000-0000000000d2', '{"top_speed_kmh": 300}'::jsonb, 'ai')),
  null, 'the service role (AI scan) proposes with a null proposer');
select tests.clear_authentication();

-- ---------- admin verification overwrites and stamps ----------
select tests.authenticate_as('80000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$select public.verify_catalog_specs('80000000-0000-0000-0000-0000000000d1', '{"drivetrain": "4wd"}'::jsonb)$$,
  '22023', 'specs_invalid', 'verify rejects an invalid shape');
select is(
  (select specs from public.verify_catalog_specs(
     '80000000-0000-0000-0000-0000000000d1',
     '{"power_kw": 206, "torque_nm": 392, "weight_kg": 1560, "zero_to_100_s": 4.9, "top_speed_kmh": 250, "drivetrain": "awd", "drag_cd": 0.34, "model_year": 1999}'::jsonb,
     'manufacturer')),
  '{"power_kw": 206, "torque_nm": 392, "weight_kg": 1560, "zero_to_100_s": 4.9, "top_speed_kmh": 250, "drivetrain": "awd", "drag_cd": 0.34, "model_year": 1999}'::jsonb,
  'verify overwrites the proposal with the admin''s specs');
select tests.clear_authentication();
select ok(
  (select specs_verified_at is not null and specs_verified_by = '80000000-0000-0000-0000-00000000000c'
     and specs_source = 'manufacturer' and specs_proposed_by = '80000000-0000-0000-0000-00000000000a'
   from public.catalog_models where id = '80000000-0000-0000-0000-0000000000d1'),
  'verify stamps verified_by/at and source, keeping the original proposer');
select is(
  (select count(*)::int from public.domain_events where type = 'catalog.specs_verified'
     and entity_id = '80000000-0000-0000-0000-0000000000d1'
     and actor_id = '80000000-0000-0000-0000-00000000000c'),
  1, 'catalog.specs_verified is emitted');

-- ---------- verified wins over proposed ----------
select tests.authenticate_as('80000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$select public.propose_catalog_specs('80000000-0000-0000-0000-0000000000d1', '{"power_kw": 1}'::jsonb, 'troll')$$,
  'P0001', 'specs_already_verified', 'a proposal on verified specs is refused');
select tests.clear_authentication();
select is(
  (select specs->>'power_kw' from public.catalog_models where id = '80000000-0000-0000-0000-0000000000d1'),
  '206', 'the verified specs are untouched by the refused proposal');

select * from finish();
rollback;
