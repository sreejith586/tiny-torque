-- pgTAP for the offer-creation RPCs (MV-S5-02, F-08). create_offer validation + buy_now instant
-- reserve / auto-decline / owner / not-for-sale guards. Run via CI's pgTAP job.

begin;
select plan(10);

insert into auth.users (id) values
  ('60000000-0000-0000-0000-00000000000a'),
  ('60000000-0000-0000-0000-00000000000b'),
  ('60000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, display_name, account_type, handle, plan) values
  ('60000000-0000-0000-0000-00000000000a', 'Seller', 'individual', 'bn_s', 'pro'),
  ('60000000-0000-0000-0000-00000000000b', 'Buyer', 'individual', 'bn_b', 'free'),
  ('60000000-0000-0000-0000-00000000000c', 'Buyer2', 'individual', 'bn_b2', 'free');
insert into public.marketplace_listings (id, seller_id, brand, status, price, currency, listing_type) values
  ('60000000-0000-0000-0000-0000000000f0', '60000000-0000-0000-0000-00000000000a', 'HW', 'active', 100, 'AED', 'sale'),
  ('60000000-0000-0000-0000-0000000000f1', '60000000-0000-0000-0000-00000000000a', 'HW', 'active', 80, 'AED', 'trade');
-- a competing pending offer that buy_now should auto-decline
insert into public.offers (id, listing_id, buyer_id, seller_id, type, amount, status) values
  ('60000000-0000-0000-0000-0000000000e2', '60000000-0000-0000-0000-0000000000f0', '60000000-0000-0000-0000-00000000000c', '60000000-0000-0000-0000-00000000000a', 'cash', 70, 'pending');

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

-- seller cannot buy their own listing
select tests.authenticate_as('60000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$select public.buy_now('60000000-0000-0000-0000-0000000000f0')$$,
  'P0001', 'cannot_buy_own_listing', 'seller cannot buy their own listing');

-- buy_now on a trade-only listing is rejected
select tests.clear_authentication();
select tests.authenticate_as('60000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$select public.buy_now('60000000-0000-0000-0000-0000000000f1')$$,
  'P0001', 'not_for_sale', 'buy_now is rejected on a trade-only listing');

-- buyer buys now: offer born accepted at the listing price
select is((select status::text from public.buy_now('60000000-0000-0000-0000-0000000000f0')),
  'accepted', 'buy_now creates an accepted offer');
select is((select amount from public.offers where listing_id = '60000000-0000-0000-0000-0000000000f0' and type = 'buy_now'),
  100::numeric, 'the buy_now offer is at the listing price');
select is((select status::text from public.marketplace_listings where id = '60000000-0000-0000-0000-0000000000f0'),
  'reserved', 'buy_now reserves the listing');
select is((select status::text from public.offers where id = '60000000-0000-0000-0000-0000000000e2'),
  'declined', 'buy_now auto-declines the other pending offer');

-- ---------- create_offer validation ----------
-- a fresh open-to-offers listing (price 100, min 50) for cash-offer checks
insert into public.marketplace_listings (id, seller_id, brand, status, price, currency, listing_type, open_to_offers, min_offer)
  values ('60000000-0000-0000-0000-0000000000f2', '60000000-0000-0000-0000-00000000000a', 'HW', 'active', 100, 'AED', 'both', true, 50);
select tests.clear_authentication();
select tests.authenticate_as('60000000-0000-0000-0000-00000000000b');

select throws_ok(
  $$select public.create_offer('60000000-0000-0000-0000-0000000000f2','cash',40)$$,
  'P0001', 'below_min_offer', 'create_offer rejects a cash amount below the floor');
select throws_ok(
  $$select public.create_offer('60000000-0000-0000-0000-0000000000f2','cash',400)$$,
  'P0001', 'above_sanity_cap', 'create_offer rejects a cash amount above 3x price');
select is(
  (select status::text from public.create_offer('60000000-0000-0000-0000-0000000000f2','cash',60)),
  'pending', 'create_offer inserts a valid pending cash offer');
-- trade with an item the buyer does not own/public → rejected
select throws_ok(
  $$select public.create_offer('60000000-0000-0000-0000-0000000000f2','trade',null,array['99999999-9999-4999-8999-999999999999'::uuid])$$,
  'P0001', 'trade_item_invalid', 'create_offer rejects a trade with a non-owned item');

select * from finish();
rollback;
