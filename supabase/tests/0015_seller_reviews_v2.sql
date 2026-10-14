-- pgTAP for seller_reviews v2 (MV-S6-03, F-10, D-013). Insert tied to a real completed offer,
-- unique per offer, rating_avg/rating_count recomputed by trigger. Run via CI's pgTAP job.

begin;
select plan(7);

insert into auth.users (id) values
  ('91000000-0000-0000-0000-00000000000a'),
  ('91000000-0000-0000-0000-00000000000b'),
  ('91000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, display_name, account_type, handle, plan) values
  ('91000000-0000-0000-0000-00000000000a', 'Seller', 'individual', 'sr_s', 'free'),
  ('91000000-0000-0000-0000-00000000000b', 'Buyer', 'individual', 'sr_b', 'free'),
  ('91000000-0000-0000-0000-00000000000c', 'OtherSeller', 'individual', 'sr_o', 'free');
insert into public.marketplace_listings (id, seller_id, brand, status, price, currency, listing_type, open_to_offers)
  values ('91000000-0000-0000-0000-0000000000f0', '91000000-0000-0000-0000-00000000000a', 'HW', 'sold', 50, 'AED', 'sale', false);
insert into public.offers (id, listing_id, buyer_id, seller_id, type, amount, status) values
  ('91000000-0000-0000-0000-0000000000e1', '91000000-0000-0000-0000-0000000000f0', '91000000-0000-0000-0000-00000000000b', '91000000-0000-0000-0000-00000000000a', 'cash', 50, 'completed'),
  ('91000000-0000-0000-0000-0000000000e2', '91000000-0000-0000-0000-0000000000f0', '91000000-0000-0000-0000-00000000000b', '91000000-0000-0000-0000-00000000000a', 'cash', 45, 'accepted');

create schema if not exists tests;
create or replace function tests.authenticate_as(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end; $$;
create or replace function tests.clear_authentication() returns void language plpgsql as $$
begin perform set_config('role', 'supabase_admin', true); perform set_config('request.jwt.claim.sub', '', true); end; $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

select has_column('public', 'profiles', 'rating_avg', 'profiles has rating_avg');
select has_column('public', 'profiles', 'rating_count', 'profiles has rating_count');
select col_not_null('public', 'seller_reviews', 'offer_id', 'offer_id is not null');

-- the buyer cannot review on a non-completed offer
select tests.authenticate_as('91000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$insert into public.seller_reviews (seller_id, buyer_id, offer_id, rating, comment)
    values ('91000000-0000-0000-0000-00000000000a','91000000-0000-0000-0000-00000000000b','91000000-0000-0000-0000-0000000000e2',5,'great')$$,
  '42501', null, 'cannot review a non-completed offer');

-- the real buyer can review the completed offer, and rating_avg/count recompute immediately
select lives_ok(
  $$insert into public.seller_reviews (seller_id, buyer_id, offer_id, rating, comment)
    values ('91000000-0000-0000-0000-00000000000a','91000000-0000-0000-0000-00000000000b','91000000-0000-0000-0000-0000000000e1',4,'good deal')$$,
  'buyer can review a completed offer');
select tests.clear_authentication();
select is(
  (select rating_count from public.profiles where id = '91000000-0000-0000-0000-00000000000a'),
  1, 'rating_count recomputed to 1 after the review');

-- a second review on the same offer is rejected (unique offer_id)
select tests.authenticate_as('91000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$insert into public.seller_reviews (seller_id, buyer_id, offer_id, rating, comment)
    values ('91000000-0000-0000-0000-00000000000a','91000000-0000-0000-0000-00000000000b','91000000-0000-0000-0000-0000000000e1',2,'again')$$,
  '23505', null, 'a second review on the same offer is rejected');

select * from finish();
rollback;
