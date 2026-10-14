-- pgTAP for create_report rate limit + block-aware listing/profile visibility (MV-S6-05, F-15).

begin;
select plan(5);

insert into auth.users (id) values
  ('92000000-0000-0000-0000-00000000000a'),
  ('92000000-0000-0000-0000-00000000000b'),
  ('92000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, display_name, account_type, handle, plan) values
  ('92000000-0000-0000-0000-00000000000a', 'Seller', 'individual', 'rb_s', 'free'),
  ('92000000-0000-0000-0000-00000000000b', 'Reporter', 'individual', 'rb_r', 'free'),
  ('92000000-0000-0000-0000-00000000000c', 'Stranger', 'individual', 'rb_x', 'free');
insert into public.marketplace_listings (id, seller_id, brand, status, price, currency, listing_type, open_to_offers)
  values ('92000000-0000-0000-0000-0000000000f0', '92000000-0000-0000-0000-00000000000a', 'HW', 'active', 50, 'AED', 'sale', false);

create schema if not exists tests;
create or replace function tests.authenticate_as(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end; $$;
create or replace function tests.authenticate_as_anon() returns void language plpgsql as $$
begin perform set_config('role', 'anon', true); perform set_config('request.jwt.claim.sub', '', true); end; $$;
create or replace function tests.clear_authentication() returns void language plpgsql as $$
begin perform set_config('role', 'supabase_admin', true); perform set_config('request.jwt.claim.sub', '', true); end; $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- a report within the daily limit succeeds
select tests.authenticate_as('92000000-0000-0000-0000-00000000000b');
select lives_ok(
  $$select public.create_report('listing','92000000-0000-0000-0000-0000000000f0','HW','spam','looks fake')$$,
  'a report within the daily limit succeeds');

-- backfill 9 more reports from the same reporter in the last 24h (10 total), then the 11th is rate-limited
select tests.clear_authentication();
insert into public.reports (target_type, target_id, reporter_id, created_at)
  select 'listing', '92000000-0000-0000-0000-0000000000f0', '92000000-0000-0000-0000-00000000000b', now()
  from generate_series(1, 9);
select tests.authenticate_as('92000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$select public.create_report('listing','92000000-0000-0000-0000-0000000000f0','HW','spam','again')$$,
  'P0001', 'rate_limited', 'the 11th report in 24h is rate-limited');

-- blocking hides the seller's listing from the blocker (and vice versa, is_blocked is symmetric)
select tests.clear_authentication();
insert into public.blocks (blocker_id, blocked_id) values ('92000000-0000-0000-0000-00000000000c', '92000000-0000-0000-0000-00000000000a');
select tests.authenticate_as('92000000-0000-0000-0000-00000000000c');
select is(
  (select count(*)::int from public.marketplace_listings where id = '92000000-0000-0000-0000-0000000000f0'),
  0, 'a blocked seller''s listing is hidden from the blocker');

-- and the seller's public profile is hidden from the blocker too
select is(
  (select count(*)::int from public.public_profiles where id = '92000000-0000-0000-0000-00000000000a'),
  0, 'a blocked seller''s public profile is hidden from the blocker');

-- an unrelated (non-blocked) user still sees both normally
select tests.clear_authentication();
select tests.authenticate_as('92000000-0000-0000-0000-00000000000b');
select is(
  (select count(*)::int from public.marketplace_listings where id = '92000000-0000-0000-0000-0000000000f0'),
  1, 'a non-blocked user still sees the listing');

select * from finish();
rollback;
