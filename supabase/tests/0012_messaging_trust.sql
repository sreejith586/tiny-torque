-- pgTAP for messaging + trust (MV-S6-01, F-09/F-15, D-013). Block symmetry + offer block check,
-- deal_messages RLS (party read, insert only on a live deal, declined-offer + blocked denied),
-- reports resolution columns. Run via CI's pgTAP job.

begin;
select plan(9);

insert into auth.users (id) values
  ('90000000-0000-0000-0000-00000000000a'),
  ('90000000-0000-0000-0000-00000000000b'),
  ('90000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, display_name, account_type, handle, plan) values
  ('90000000-0000-0000-0000-00000000000a', 'Seller', 'individual', 'mt_s', 'pro'),
  ('90000000-0000-0000-0000-00000000000b', 'Buyer', 'individual', 'mt_b', 'free'),
  ('90000000-0000-0000-0000-00000000000c', 'Stranger', 'individual', 'mt_x', 'free');
insert into public.marketplace_listings (id, seller_id, brand, status, price, currency, listing_type, open_to_offers, min_offer)
  values ('90000000-0000-0000-0000-0000000000f0', '90000000-0000-0000-0000-00000000000a', 'HW', 'active', 100, 'AED', 'both', true, 50);
insert into public.offers (id, listing_id, buyer_id, seller_id, type, amount, status) values
  ('90000000-0000-0000-0000-0000000000e1', '90000000-0000-0000-0000-0000000000f0', '90000000-0000-0000-0000-00000000000b', '90000000-0000-0000-0000-00000000000a', 'cash', 60, 'accepted'),
  ('90000000-0000-0000-0000-0000000000e2', '90000000-0000-0000-0000-0000000000f0', '90000000-0000-0000-0000-00000000000b', '90000000-0000-0000-0000-00000000000a', 'cash', 55, 'declined');

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

-- reports resolution columns landed
select has_column('public', 'reports', 'resolved_by', 'reports has resolved_by');
select has_column('public', 'reports', 'resolution_note', 'reports has resolution_note');

-- is_blocked is symmetric
select tests.clear_authentication();
insert into public.blocks (blocker_id, blocked_id) values ('90000000-0000-0000-0000-00000000000a', '90000000-0000-0000-0000-00000000000b');
select ok(public.is_blocked('90000000-0000-0000-0000-00000000000b', '90000000-0000-0000-0000-00000000000a'), 'is_blocked is symmetric');

-- a blocked buyer cannot create an offer
select tests.authenticate_as('90000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$select public.create_offer('90000000-0000-0000-0000-0000000000f0','cash',60)$$,
  'P0001', 'blocked', 'a blocked buyer cannot create an offer');

-- a blocked party cannot message
select throws_ok(
  $$insert into public.deal_messages (offer_id, sender_id, body)
    values ('90000000-0000-0000-0000-0000000000e1','90000000-0000-0000-0000-00000000000b','hi')$$,
  '42501', null, 'a blocked party cannot message');

-- unblock, then a party CAN message on the accepted offer
select tests.clear_authentication();
delete from public.blocks;
select tests.authenticate_as('90000000-0000-0000-0000-00000000000b');
select lives_ok(
  $$insert into public.deal_messages (offer_id, sender_id, body)
    values ('90000000-0000-0000-0000-0000000000e1','90000000-0000-0000-0000-00000000000b','hi there')$$,
  'a party can message on an accepted offer');

-- F-09 AC: messaging on a DECLINED offer is rejected by RLS
select throws_ok(
  $$insert into public.deal_messages (offer_id, sender_id, body)
    values ('90000000-0000-0000-0000-0000000000e2','90000000-0000-0000-0000-00000000000b','hello')$$,
  '42501', null, 'messaging on a declined offer is rejected (F-09 AC)');

-- a stranger (not a party) cannot read the thread
select tests.clear_authentication();
select tests.authenticate_as('90000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.deal_messages where offer_id = '90000000-0000-0000-0000-0000000000e1'),
  0, 'a non-party cannot read the thread');

-- the seller (a party) can read it
select tests.clear_authentication();
select tests.authenticate_as('90000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.deal_messages where offer_id = '90000000-0000-0000-0000-0000000000e1'),
  1, 'a party reads the thread');

select * from finish();
rollback;
