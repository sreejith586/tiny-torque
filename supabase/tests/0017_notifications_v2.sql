-- pgTAP for the extended notification consumer (MV-S6-06, F-12): message + review notifications.

begin;
select plan(4);

insert into auth.users (id) values
  ('93000000-0000-0000-0000-00000000000a'),
  ('93000000-0000-0000-0000-00000000000b');
insert into public.profiles (id, display_name, account_type, handle, plan) values
  ('93000000-0000-0000-0000-00000000000a', 'Seller', 'individual', 'nt_s', 'free'),
  ('93000000-0000-0000-0000-00000000000b', 'Buyer', 'individual', 'nt_b', 'free');
insert into public.marketplace_listings (id, seller_id, brand, status, price, currency, listing_type, open_to_offers)
  values ('93000000-0000-0000-0000-0000000000f0', '93000000-0000-0000-0000-00000000000a', 'HW', 'sold', 50, 'AED', 'sale', false);
insert into public.offers (id, listing_id, buyer_id, seller_id, type, amount, status) values
  ('93000000-0000-0000-0000-0000000000e1', '93000000-0000-0000-0000-0000000000f0', '93000000-0000-0000-0000-00000000000b', '93000000-0000-0000-0000-00000000000a', 'cash', 50, 'completed');

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

-- buyer messages the seller -> the SELLER (the other party) gets a 'message' notification
select tests.authenticate_as('93000000-0000-0000-0000-00000000000b');
select lives_ok(
  $$insert into public.deal_messages (offer_id, sender_id, body)
    values ('93000000-0000-0000-0000-0000000000e1','93000000-0000-0000-0000-00000000000b','hi there')$$,
  'buyer can message on the completed offer');
select tests.clear_authentication();
select is(
  (select count(*)::int from public.notifications where user_id = '93000000-0000-0000-0000-00000000000a' and type = 'message'),
  1, 'the seller got a message notification');
select is(
  (select count(*)::int from public.notifications where user_id = '93000000-0000-0000-0000-00000000000b' and type = 'message'),
  0, 'the sender did not notify themselves');

-- the buyer reviews the seller -> a review.created event + a review_received notification for the seller
select tests.authenticate_as('93000000-0000-0000-0000-00000000000b');
insert into public.seller_reviews (seller_id, buyer_id, offer_id, rating)
  values ('93000000-0000-0000-0000-00000000000a','93000000-0000-0000-0000-00000000000b','93000000-0000-0000-0000-0000000000e1',5);
select tests.clear_authentication();
select is(
  (select count(*)::int from public.notifications where user_id = '93000000-0000-0000-0000-00000000000a' and type = 'review_received'),
  1, 'the seller got a review_received notification');

select * from finish();
rollback;
