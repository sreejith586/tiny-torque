-- pgTAP for the offer-listing-visibility fix (20261012000000, MV-S5-04 prerequisite). A buyer with
-- an offer on a listing must still be able to read it once it leaves 'active' (reserved/sold) —
-- the /offers "Sent" tab depends on this — while a stranger with no offer still cannot.

begin;
select plan(3);

insert into auth.users (id) values
  ('60000000-0000-0000-0000-00000000000a'),
  ('60000000-0000-0000-0000-00000000000b'),
  ('60000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, display_name, account_type, handle, plan) values
  ('60000000-0000-0000-0000-00000000000a', 'Seller', 'individual', 'olv_seller', 'pro'),
  ('60000000-0000-0000-0000-00000000000b', 'Buyer', 'individual', 'olv_buyer', 'free'),
  ('60000000-0000-0000-0000-00000000000c', 'Stranger', 'individual', 'olv_stranger', 'free');
insert into public.marketplace_listings (id, seller_id, brand, status, price)
  values ('60000000-0000-0000-0000-0000000000f0', '60000000-0000-0000-0000-00000000000a', 'HW', 'reserved', 100);
insert into public.offers (id, listing_id, buyer_id, seller_id, type, amount, status)
  values ('60000000-0000-0000-0000-0000000000e0', '60000000-0000-0000-0000-0000000000f0',
          '60000000-0000-0000-0000-00000000000b', '60000000-0000-0000-0000-00000000000a', 'cash', 100, 'accepted');

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
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- the buyer (has an offer on this listing) can still read it now that it's reserved
select tests.authenticate_as('60000000-0000-0000-0000-00000000000b');
select is(
  (select count(*) from public.marketplace_listings where id = '60000000-0000-0000-0000-0000000000f0')::int,
  1, 'a buyer with an offer can read a reserved listing');

-- a stranger with no offer on it cannot
select tests.authenticate_as('60000000-0000-0000-0000-00000000000c');
select is(
  (select count(*) from public.marketplace_listings where id = '60000000-0000-0000-0000-0000000000f0')::int,
  0, 'a stranger with no offer cannot read a reserved listing');

-- anon cannot either
select tests.authenticate_as_anon();
select is(
  (select count(*) from public.marketplace_listings where id = '60000000-0000-0000-0000-0000000000f0')::int,
  0, 'anon cannot read a reserved listing');

select * from finish();
rollback;
