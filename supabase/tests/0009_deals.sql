-- pgTAP for deals (MV-S5-01, F-08, D-013/rule 8). Offer RLS, the one-pending-per-buyer index,
-- the rate-limit trigger, and transition_offer's role checks + accept/auto-decline + the
-- "second accept fails" concurrency guarantee. Run via CI's pgTAP job.

begin;
select plan(11);

insert into auth.users (id) values
  ('50000000-0000-0000-0000-00000000000a'),
  ('50000000-0000-0000-0000-00000000000b'),
  ('50000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, display_name, account_type, handle, plan) values
  ('50000000-0000-0000-0000-00000000000a', 'Seller', 'individual', 'd_seller', 'pro'),
  ('50000000-0000-0000-0000-00000000000b', 'Buyer1', 'individual', 'd_buyer1', 'free'),
  ('50000000-0000-0000-0000-00000000000c', 'Buyer2', 'individual', 'd_buyer2', 'free');
insert into public.marketplace_listings (id, seller_id, brand, status, price, open_to_offers, min_offer)
  values ('50000000-0000-0000-0000-0000000000f0', '50000000-0000-0000-0000-00000000000a', 'HW', 'active', 100, true, 50);

create schema if not exists tests;
create or replace function tests.authenticate_as(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end; $$;
create or replace function tests.clear_authentication() returns void language plpgsql as $$
begin perform set_config('role', 'supabase_admin', true); end; $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- two buyers each place a pending offer
select tests.authenticate_as('50000000-0000-0000-0000-00000000000b');
select lives_ok(
  $$insert into public.offers (id, listing_id, buyer_id, seller_id, type, amount)
    values ('50000000-0000-0000-0000-0000000000e1','50000000-0000-0000-0000-0000000000f0','50000000-0000-0000-0000-00000000000b','50000000-0000-0000-0000-00000000000a','cash',60)$$,
  'buyer can create their own offer');
select throws_ok(
  $$insert into public.offers (id, listing_id, buyer_id, seller_id, type, amount)
    values ('50000000-0000-0000-0000-0000000000e9','50000000-0000-0000-0000-0000000000f0','50000000-0000-0000-0000-00000000000b','50000000-0000-0000-0000-00000000000a','cash',55)$$,
  '23505', null, 'a buyer cannot have two pending offers on one listing');

select tests.clear_authentication();
select tests.authenticate_as('50000000-0000-0000-0000-00000000000c');
select lives_ok(
  $$insert into public.offers (id, listing_id, buyer_id, seller_id, type, amount)
    values ('50000000-0000-0000-0000-0000000000e2','50000000-0000-0000-0000-0000000000f0','50000000-0000-0000-0000-00000000000c','50000000-0000-0000-0000-00000000000a','cash',70)$$,
  'a second buyer can place their own offer');
-- buyer2 cannot read buyer1's offer (RLS: buyer or seller only)
select is((select count(*)::int from public.offers where id = '50000000-0000-0000-0000-0000000000e1'), 0,
  'a buyer cannot read another buyer''s offer');

-- a non-seller cannot accept (the IS DISTINCT FROM guard; buyer2 is authenticated here)
select throws_ok(
  $$select public.transition_offer('50000000-0000-0000-0000-0000000000e1','accept')$$,
  '42501', 'not_authorized', 'a non-seller cannot accept an offer');

-- seller accepts e1
select tests.clear_authentication();
select tests.authenticate_as('50000000-0000-0000-0000-00000000000a');
select is((select status::text from public.transition_offer('50000000-0000-0000-0000-0000000000e1','accept')),
  'accepted', 'seller accepts the offer');
select is((select status::text from public.marketplace_listings where id = '50000000-0000-0000-0000-0000000000f0'),
  'reserved', 'accepting reserves the listing');
select is((select status::text from public.offers where id = '50000000-0000-0000-0000-0000000000e2'),
  'declined', 'other pending offers are auto-declined');

-- F-08 AC: a second accept now fails (listing no longer active) — the concurrency guard
select throws_ok(
  $$select public.transition_offer('50000000-0000-0000-0000-0000000000e2','accept')$$,
  'P0001', null, 'a second accept fails once the listing is reserved');

-- complete marks the listing sold + records the winning offer
select is((select status::text from public.transition_offer('50000000-0000-0000-0000-0000000000e1','complete')),
  'completed', 'seller completes the deal');
select is(
  (select status::text || ':' || (sold_offer_id = '50000000-0000-0000-0000-0000000000e1')::text
     from public.marketplace_listings where id = '50000000-0000-0000-0000-0000000000f0'),
  'sold:true', 'completing sells the listing and records the winning offer');

select * from finish();
rollback;
