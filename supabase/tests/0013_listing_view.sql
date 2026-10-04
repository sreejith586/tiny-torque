-- pgTAP for increment_listing_view (MV-S4-05, F-06). Anon can bump an active listing's view_count;
-- a removed/non-existent listing is a no-op. Run via CI's pgTAP job.

begin;
select plan(3);

insert into auth.users (id) values ('a0000000-0000-0000-0000-00000000000a');
insert into public.profiles (id, display_name, account_type, handle, plan) values
  ('a0000000-0000-0000-0000-00000000000a', 'Seller', 'individual', 'lv_seller', 'pro');
insert into public.marketplace_listings (id, seller_id, brand, status, price) values
  ('a0000000-0000-0000-0000-0000000000f0', 'a0000000-0000-0000-0000-00000000000a', 'HW', 'active', 10),
  ('a0000000-0000-0000-0000-0000000000f1', 'a0000000-0000-0000-0000-00000000000a', 'HW', 'removed', 10);

create schema if not exists tests;
create or replace function tests.authenticate_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end; $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- anon can increment an active listing's view counter
select tests.authenticate_as_anon();
do $$ begin
  perform public.increment_listing_view('a0000000-0000-0000-0000-0000000000f0');
  perform public.increment_listing_view('a0000000-0000-0000-0000-0000000000f0');
end $$;
select set_config('role', 'supabase_admin', true);
select is(
  (select view_count from public.marketplace_listings where id = 'a0000000-0000-0000-0000-0000000000f0'),
  2, 'anon increments an active listing view_count');

-- a removed listing is not incremented
select tests.authenticate_as_anon();
do $$ begin perform public.increment_listing_view('a0000000-0000-0000-0000-0000000000f1'); end $$;
select set_config('role', 'supabase_admin', true);
select is(
  (select view_count from public.marketplace_listings where id = 'a0000000-0000-0000-0000-0000000000f1'),
  0, 'a removed listing is not incremented');

-- a non-existent id is a harmless no-op
select lives_ok(
  $$select public.increment_listing_view('a0000000-0000-0000-0000-0000000000ff')$$,
  'incrementing an unknown listing is a no-op');

select * from finish();
rollback;
