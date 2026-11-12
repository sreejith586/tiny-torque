-- pgTAP — MV-S10-03/04/05 (F-18, F-16, F-15): pilot_kpis_weekly + its refresh/read RPCs,
-- admin_overview(), and the feedback → admin notification trigger. Run via CI's pgTAP job.

begin;
select plan(28);

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
  perform set_config('request.jwt.claims', '', true);
end; $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- Baseline of the current UTC week BEFORE this file's rows (other seeds may exist).
create temp table base as
  select * from public.pilot_kpis_weekly
   where week_start = date_trunc('week', now() at time zone 'utc')::date;
select is((select count(*)::int from public.pilot_kpis_weekly), 52, 'the view carries the last 52 UTC weeks');
select is((select count(*)::int from base), 1, 'the current week is one of them');

insert into auth.users (id) values
  ('b2000000-0000-0000-0000-00000000000a'),
  ('b2000000-0000-0000-0000-00000000000b'),
  ('b2000000-0000-0000-0000-00000000000c'),
  ('b2000000-0000-0000-0000-00000000000d');
insert into public.profiles (id, display_name, account_type, handle, role, mobile) values
  ('b2000000-0000-0000-0000-00000000000a', 'Active', 'individual', 'kp_active', 'user', '+971500002001'),
  ('b2000000-0000-0000-0000-00000000000b', 'Quiet', 'individual', 'kp_quiet', 'user', null),
  ('b2000000-0000-0000-0000-00000000000c', 'Admin one', 'individual', 'kp_admin1', 'admin', null),
  ('b2000000-0000-0000-0000-00000000000d', 'Admin two', 'individual', 'kp_admin2', 'admin', null);

-- "Active": 5 items (activated), 2 scans (5 candidates, 3 accepted, $0.03), 1 listing, 1 paid pack
insert into public.collection_items (id, owner_id, brand, model)
  select ('b2000000-0000-0000-0000-0000000001a' || g)::uuid, 'b2000000-0000-0000-0000-00000000000a', 'Hot Wheels', 'Car ' || g
  from generate_series(1, 5) g;
insert into public.collection_items (owner_id, brand, model) values
  ('b2000000-0000-0000-0000-00000000000b', 'Tomica', 'Only one');
insert into public.ai_scan_jobs (user_id, kind, status, candidates, accepted_count, cost_usd) values
  ('b2000000-0000-0000-0000-00000000000a', 'single', 'done', '[{"model":"a"},{"model":"b"}]', 1, 0.01),
  ('b2000000-0000-0000-0000-00000000000a', 'group', 'done', '[{"model":"c"},{"model":"d"},{"model":"e"}]', 2, 0.02);
insert into public.marketplace_listings (id, seller_id, brand, model, price, status, source_item_id) values
  ('b2000000-0000-0000-0000-0000000000b1', 'b2000000-0000-0000-0000-00000000000a', 'Hot Wheels', 'Car 1', 100, 'active',
   'b2000000-0000-0000-0000-0000000001a1');
insert into public.offers (id, listing_id, buyer_id, seller_id, type, amount, status, completed_at) values
  ('b2000000-0000-0000-0000-0000000000c1', 'b2000000-0000-0000-0000-0000000000b1', 'b2000000-0000-0000-0000-00000000000b',
   'b2000000-0000-0000-0000-00000000000a', 'cash', 110, 'completed', now());
insert into public.seller_reviews (seller_id, offer_id, buyer_id, rating) values
  ('b2000000-0000-0000-0000-00000000000a', 'b2000000-0000-0000-0000-0000000000c1', 'b2000000-0000-0000-0000-00000000000b', 5);
insert into public.token_purchases (user_id, pack_id, amount, currency, status, paid_at)
  select 'b2000000-0000-0000-0000-00000000000a', id, 19, 'AED', 'paid', now() from public.token_packs order by sku limit 1;
insert into public.reports (target_type, target_id, reason, reporter_id, status, resolved_at) values
  ('listing', 'x', 'spam', 'b2000000-0000-0000-0000-00000000000b', 'reviewed', now());

-- ---------- refresh: as the scheduler (no JWT), logged in job_runs ----------
select is((select status from public.refresh_pilot_kpis()), 'ok', 'refresh_pilot_kpis() runs as the scheduler');
select is(
  (select triggered_by || '/' || (result ->> 'weeks') from public.job_runs
    where job = 'refresh_pilot_kpis' order by id desc limit 1),
  'cron/52', 'the run is logged in job_runs with its source and row count');

create temp table cur as
  select * from public.pilot_kpis_weekly
   where week_start = date_trunc('week', now() at time zone 'utc')::date;

select is((select c.signups - b.signups from cur c, base b), 4, 'signups counts this week''s new profiles');
select is((select c.activated_7d - b.activated_7d from cur c, base b), 1, 'activated_7d = sign-ups with ≥ 5 items inside 7 days (01 §6 activation)');
select is((select c.items_added - b.items_added from cur c, base b), 6, 'items_added');
select is(
  (select array[c.scans - b.scans, c.scan_candidates - b.scan_candidates, c.scan_accepted - b.scan_accepted] from cur c, base b),
  array[2, 5, 3], 'scan volume, candidates and accepted candidates (scan usage + accuracy)');
select is((select c.scan_cost_usd - b.scan_cost_usd from cur c, base b), 0.03::numeric, 'scan_cost_usd sums ai_scan_jobs.cost_usd');
select is(
  (select array[c.listings_published - b.listings_published, c.publishers - b.publishers, c.signups_published - b.signups_published,
                c.listings_live - b.listings_live] from cur c, base b),
  array[1, 1, 1, 1], 'marketplace supply: listings, publishers, publishing sign-ups, live listings');
select is(
  (select array[c.offers_created - b.offers_created, c.deals_completed - b.deals_completed, c.deals_reviewed - b.deals_reviewed] from cur c, base b),
  array[1, 1, 1], 'deal flow: offers, completed deals, completed deals with a review');
select is(
  (select array[c.token_purchases - b.token_purchases, c.token_buyers - b.token_buyers] from cur c, base b),
  array[1, 1], 'token purchases and distinct buyers');
select is(
  (select (c.token_revenue ->> 'AED')::numeric - coalesce((b.token_revenue ->> 'AED')::numeric, 0) from cur c, base b),
  19::numeric, 'token_revenue is keyed by currency');
select is((select c.reports_actioned - b.reports_actioned from cur c, base b), 1, 'reports_actioned counts reviewed reports');
select ok((select c.wau - b.wau from cur c, base b) >= 1, 'wau counts distinct actors in the event log');

-- ---------- admin read + refresh ----------
select tests.authenticate_as('b2000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.admin_pilot_kpis(4)), 4, 'admin_pilot_kpis(n) returns the newest n weeks to an admin');
select is((select triggered_by from public.refresh_pilot_kpis()), 'manual', 'an admin''s refresh is logged as manual');
select is(
  (select array[o.scans_month >= 2, o.scan_cost_usd_month >= 0.03, o.token_purchases_month >= 1,
                (o.token_revenue_month ->> 'AED')::numeric >= 19, o.users >= 4, o.items >= 6,
                o.listings_active >= 1, o.deals_completed >= 1]
     from public.admin_overview() o),
  array[true, true, true, true, true, true, true, true],
  'admin_overview() returns the Overview tiles (counts, this month''s scan cost and token revenue)');

-- ---------- feedback → admin notifications ----------
select tests.authenticate_as('b2000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$insert into public.feedback (user_id, kind, message, page) values ('b2000000-0000-0000-0000-00000000000a', 'bug', 'The scan button is stuck', '/garage/scan')$$,
  'a collector submits feedback');
select tests.clear_authentication();
select is(
  (select count(*)::int from public.notifications n
    where n.type = 'feedback_received' and n.payload ->> 'kind' = 'bug'
      and n.user_id in ('b2000000-0000-0000-0000-00000000000c', 'b2000000-0000-0000-0000-00000000000d')),
  2, 'every admin gets one feedback_received notification');
select is(
  (select count(*)::int from public.notifications
    where type = 'feedback_received' and user_id = 'b2000000-0000-0000-0000-00000000000a'),
  0, 'the submitter is not notified');
select tests.authenticate_as('b2000000-0000-0000-0000-00000000000c');
insert into public.feedback (user_id, kind, message) values ('b2000000-0000-0000-0000-00000000000c', 'idea', 'Admin''s own idea');
select tests.clear_authentication();
select is(
  (select count(*)::int from public.notifications
    where type = 'feedback_received' and payload ->> 'kind' = 'idea' and user_id = 'b2000000-0000-0000-0000-00000000000c'),
  0, 'an admin submitting feedback is not notified about their own');

-- ---------- PostHog mirror: claim_analytics_events (F-18) ----------
select tests.authenticate_as('b2000000-0000-0000-0000-00000000000a');
create temp table claimed as select * from public.claim_analytics_events(100);
grant select on claimed to authenticated;
select ok(
  (select count(*) from claimed where type = 'item.created') = 5
  and (select count(*) from claimed where type = 'feedback.created') = 1,
  'a collector claims their own KPI events (5 item.created + 1 feedback.created)');
select is(
  (select count(*)::int from claimed c join public.domain_events e on e.id = c.id
    where e.actor_id <> 'b2000000-0000-0000-0000-00000000000a'),
  0, 'never another collector''s events');
select is((select count(*)::int from public.claim_analytics_events(100)), 0,
  'a second claim returns nothing — each event leaves once, across devices');
insert into public.collection_items (owner_id, brand, model)
  values ('b2000000-0000-0000-0000-00000000000a', 'Matchbox', 'After the cursor');
select is(
  (select array_agg(type) from public.claim_analytics_events(100)), array['item.created'],
  'only events newer than the cursor come back next time');
select is((select count(*)::int from public.analytics_cursors), 1,
  'a collector sees only their own cursor row');
select tests.clear_authentication();
select set_config('role', 'anon', true);
select throws_ok($$select * from public.claim_analytics_events(10)$$, '42501', null,
  'anon cannot call claim_analytics_events');
select tests.clear_authentication();

select * from finish();
rollback;
