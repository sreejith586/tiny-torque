-- pgTAP for the offer→notification consumer (MV-S5-06, F-12). Each offer.* event produces a
-- notifications row for the right recipient. Run via CI's pgTAP job. Reads run as admin
-- (notifications are per-user RLS).

begin;
select plan(5);

insert into auth.users (id) values
  ('80000000-0000-0000-0000-00000000000a'),
  ('80000000-0000-0000-0000-00000000000b');
insert into public.profiles (id, display_name, account_type, handle, plan) values
  ('80000000-0000-0000-0000-00000000000a', 'Seller', 'individual', 'nt_s', 'pro'),
  ('80000000-0000-0000-0000-00000000000b', 'Buyer', 'individual', 'nt_b', 'free');
insert into public.marketplace_listings (id, seller_id, brand, status, price, currency, listing_type, open_to_offers, min_offer)
  values ('80000000-0000-0000-0000-0000000000f0', '80000000-0000-0000-0000-00000000000a', 'HW', 'active', 100, 'AED', 'both', true, 50);

create schema if not exists tests;
create or replace function tests.authenticate_as(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end; $$;
create or replace function tests.clear_authentication() returns void language plpgsql as $$
begin
  perform set_config('role', 'supabase_admin', true);
  perform set_config('request.jwt.claim.sub', '', true);
end; $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- buyer makes a cash offer → the SELLER gets an offer_received notification
select tests.authenticate_as('80000000-0000-0000-0000-00000000000b');
do $$ begin perform public.create_offer('80000000-0000-0000-0000-0000000000f0', 'cash', 60); end $$;
select tests.clear_authentication();
select is((select count(*)::int from public.notifications
            where user_id = '80000000-0000-0000-0000-00000000000a' and type = 'offer_received'),
  1, 'a new cash offer notifies the seller (offer_received)');
select is((select count(*)::int from public.notifications where user_id = '80000000-0000-0000-0000-00000000000b'),
  0, 'the buyer is not notified of their own new offer');

-- seller accepts → the BUYER gets an offer_accepted notification
select tests.authenticate_as('80000000-0000-0000-0000-00000000000a');
do $$ begin perform public.transition_offer((select id from public.offers where listing_id = '80000000-0000-0000-0000-0000000000f0'), 'accept'); end $$;
select tests.clear_authentication();
select is((select count(*)::int from public.notifications
            where user_id = '80000000-0000-0000-0000-00000000000b' and type = 'offer_accepted'),
  1, 'accepting notifies the buyer (offer_accepted)');

-- the notification payload carries the offer + listing ids
select is(
  (select (payload ? 'offer_id' and payload ? 'listing_id') from public.notifications
     where user_id = '80000000-0000-0000-0000-00000000000a' and type = 'offer_received'),
  true, 'notification payload carries offer_id + listing_id');

-- a non-offer event (profile update) produces no notification
select tests.clear_authentication();
insert into public.domain_events (actor_id, type, entity, entity_id)
  values ('80000000-0000-0000-0000-00000000000a', 'profile.updated', 'profile', '80000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.notifications where type = 'system'), 0,
  'a non-offer event creates no notification');

select * from finish();
rollback;
