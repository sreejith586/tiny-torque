-- pgTAP for resolve_report + admin_search_users + admin_set_suspension (MV-S6-07, F-16).

begin;
select plan(8);

insert into auth.users (id) values
  ('94000000-0000-0000-0000-00000000000a'),
  ('94000000-0000-0000-0000-00000000000b'),
  ('94000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, display_name, account_type, handle, plan, role) values
  ('94000000-0000-0000-0000-00000000000a', 'Seller', 'individual', 'am_s', 'free', 'user'),
  ('94000000-0000-0000-0000-00000000000b', 'Reporter', 'individual', 'am_r', 'free', 'user'),
  ('94000000-0000-0000-0000-00000000000c', 'Admin', 'individual', 'am_a', 'free', 'admin');
insert into public.marketplace_listings (id, seller_id, brand, status, price, currency, listing_type, open_to_offers)
  values ('94000000-0000-0000-0000-0000000000f0', '94000000-0000-0000-0000-00000000000a', 'HW', 'active', 50, 'AED', 'sale', false);
insert into public.reports (id, target_type, target_id, target_name, reason, reporter_id) values
  ('94000000-0000-0000-0000-0000000000r1', 'listing', '94000000-0000-0000-0000-0000000000f0', 'HW', 'spam', '94000000-0000-0000-0000-00000000000b'),
  ('94000000-0000-0000-0000-0000000000r2', 'user', '94000000-0000-0000-0000-00000000000a', 'Seller', 'harassment', '94000000-0000-0000-0000-00000000000b');

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

-- a non-admin cannot resolve a report
select tests.authenticate_as('94000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$select public.resolve_report('94000000-0000-0000-0000-0000000000r1', 'dismiss', null)$$,
  '42501', null, 'a non-admin cannot resolve a report');

-- admin dismisses the user report
select tests.clear_authentication();
select tests.authenticate_as('94000000-0000-0000-0000-00000000000c');
select lives_ok(
  $$select public.resolve_report('94000000-0000-0000-0000-0000000000r2', 'dismiss', 'not credible')$$,
  'admin can dismiss a report');
select tests.clear_authentication();
select is(
  (select status::text from public.reports where id = '94000000-0000-0000-0000-0000000000r2'),
  'dismissed', 'dismissed report has the right status');

-- admin removes the listing on the other report
select tests.authenticate_as('94000000-0000-0000-0000-00000000000c');
select lives_ok(
  $$select public.resolve_report('94000000-0000-0000-0000-0000000000r1', 'remove_listing', 'confirmed counterfeit')$$,
  'admin can remove a listing via a report');
select tests.clear_authentication();
select is(
  (select status::text from public.marketplace_listings where id = '94000000-0000-0000-0000-0000000000f0'),
  'removed', 'the listing is now removed');

-- admin_search_users is admin-only
select throws_ok(
  $$select * from public.admin_search_users('Seller', 10)$$,
  '42501', null, 'a non-admin cannot search users');

-- admin_set_suspension is admin-only, and sets/clears suspended_until directly
select throws_ok(
  $$select public.admin_set_suspension('94000000-0000-0000-0000-00000000000a', 7)$$,
  '42501', null, 'a non-admin cannot suspend a user');
select tests.clear_authentication();
select tests.authenticate_as('94000000-0000-0000-0000-00000000000c');
select lives_ok(
  $$select public.admin_set_suspension('94000000-0000-0000-0000-00000000000a', 7)$$,
  'admin can suspend a user directly');
select tests.clear_authentication();
select ok(
  (select suspended_until > now() from public.profiles where id = '94000000-0000-0000-0000-00000000000a'),
  'the user is now suspended into the future');

select * from finish();
rollback;
