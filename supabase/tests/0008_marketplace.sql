-- pgTAP for marketplace_v2 (MV-S4-01, D-013). Active-listing limit (free 2 / Pro unlimited),
-- favourite-count trigger, wishlist privacy (F-07), and the rule-15 seller_mobile column lock.
-- Run via CI's pgTAP job.

begin;
select plan(8);

insert into auth.users (id) values
  ('40000000-0000-0000-0000-00000000000a'),
  ('40000000-0000-0000-0000-00000000000b');
insert into public.profiles (id, display_name, account_type, handle, plan) values
  ('40000000-0000-0000-0000-00000000000a', 'Seller', 'individual', 'mkt_seller', 'free'),
  ('40000000-0000-0000-0000-00000000000b', 'Buyer', 'individual', 'mkt_buyer', 'free');

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

-- ---------- active-listing limit (free base = 2) ----------
insert into public.marketplace_listings (seller_id, brand, status) values
  ('40000000-0000-0000-0000-00000000000a', 'Hot Wheels', 'active'),
  ('40000000-0000-0000-0000-00000000000a', 'Matchbox', 'active');
select is(public.entitlement_listing_slots('40000000-0000-0000-0000-00000000000a'), 2, 'free plan has 2 listing slots');
select throws_ok(
  $$insert into public.marketplace_listings (seller_id, brand, status)
    values ('40000000-0000-0000-0000-00000000000a', 'Tomica', 'active')$$,
  'P0001', 'listing_limit_reached', 'free seller blocked on the 3rd active listing');

-- Pro is unlimited
update public.profiles set plan = 'pro' where id = '40000000-0000-0000-0000-00000000000a';
select ok(public.entitlement_listing_slots('40000000-0000-0000-0000-00000000000a') > 1000000, 'Pro listing slots are effectively unlimited');
select lives_ok(
  $$insert into public.marketplace_listings (seller_id, brand, status)
    values ('40000000-0000-0000-0000-00000000000a', 'Tomica', 'active')$$,
  'Pro seller can exceed the free limit');

-- ---------- favourite-count trigger ----------
select tests.clear_authentication();
insert into public.listing_favorites (user_id, listing_id)
  select '40000000-0000-0000-0000-00000000000b', id
  from public.marketplace_listings where seller_id = '40000000-0000-0000-0000-00000000000a' and brand = 'Hot Wheels';
select is(
  (select favorite_count from public.marketplace_listings where brand = 'Hot Wheels' and seller_id = '40000000-0000-0000-0000-00000000000a'),
  1, 'favouriting a listing increments favorite_count');
delete from public.listing_favorites where user_id = '40000000-0000-0000-0000-00000000000b';
select is(
  (select favorite_count from public.marketplace_listings where brand = 'Hot Wheels' and seller_id = '40000000-0000-0000-0000-00000000000a'),
  0, 'un-favouriting decrements favorite_count');

-- ---------- rule-15: seller_mobile is not readable by anon ----------
select ok(
  not has_column_privilege('anon', 'public.marketplace_listings', 'seller_mobile', 'select'),
  'anon cannot read seller_mobile (rule 15)');

-- ---------- wishlist privacy (F-07): a stranger cannot read another user's wishlist ----------
insert into public.wishlist_items (owner_id, brand) values ('40000000-0000-0000-0000-00000000000a', 'Porsche');
select tests.authenticate_as('40000000-0000-0000-0000-00000000000b');
select is(
  (select count(*)::int from public.wishlist_items where owner_id = '40000000-0000-0000-0000-00000000000a'),
  0, 'wishlist is private to its owner');

select * from finish();
rollback;
