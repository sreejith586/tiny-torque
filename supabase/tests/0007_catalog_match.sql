-- pgTAP for match_catalog_models (MV-S3-02). The ai-scan trigram lookup: verified-only, best
-- score first, respects the low floor, and is callable by anon. Run via CI's pgTAP job.

begin;
select plan(5);

insert into public.catalog_models (brand_id, name, status)
select id, 'Nissan Skyline GT-R', 'verified' from public.catalog_brands where name = 'Hot Wheels';
insert into public.catalog_models (brand_id, name, status)
select id, 'Toyota Supra', 'verified' from public.catalog_brands where name = 'Hot Wheels';
insert into public.catalog_models (brand_id, name, status)
select id, 'Hidden Prototype Car', 'proposed' from public.catalog_brands where name = 'Hot Wheels';

create schema if not exists tests;
create or replace function tests.authenticate_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end; $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- a close name returns the matching verified model first
select is(
  (select name from public.match_catalog_models('Skyline GT-R', 3) limit 1),
  'Nissan Skyline GT-R',
  'closest verified model is returned first');

-- the top score clears the strong band (>= 0.6) for a near-exact name
select ok(
  (select score from public.match_catalog_models('Nissan Skyline GT-R', 1)) >= 0.6,
  'near-exact name scores in the strong band');

-- a nonsense query returns nothing (below the 0.2 floor)
select is(
  (select count(*)::int from public.match_catalog_models('zzzzzzzz', 5)),
  0,
  'a non-matching query returns no rows');

-- proposed models are never matched (catalogue is verified-only)
select is(
  (select count(*)::int from public.match_catalog_models('Hidden Prototype Car', 5)),
  0,
  'proposed models are excluded from matches');

-- anon can call the function (SECURITY DEFINER, verified-only)
select tests.authenticate_as_anon();
select ok(
  (select count(*) from public.match_catalog_models('Supra', 3)) >= 1,
  'anon can call match_catalog_models and sees verified matches');

select * from finish();
rollback;
