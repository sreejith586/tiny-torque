-- pgTAP — MV-S10-01 (F-19, D-013): the RLS matrix across EVERY public table, plus the security
-- review's fixes (docs/security-review.md). Two halves:
--   1. catalogue-driven invariants, so a table / view / definer function added by any later
--      migration (either track) is covered without touching this file;
--   2. behavioural matrix for the H1 tables: one row per private table owned by "owner", read as
--      anon / an unrelated signed-in collector / the owner / an admin, then the write attempts.
-- Run via CI's pgTAP job.

begin;
select plan(82);

create schema if not exists tests;
create or replace function tests.authenticate_as(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end; $$;
create or replace function tests.authenticate_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end; $$;
create or replace function tests.clear_authentication() returns void language plpgsql as $$
begin
  perform set_config('role', 'supabase_admin', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end; $$;
-- rows of public.<t> the CURRENT role can read; -1 = no table privilege at all
create or replace function tests.cnt(t text, w text default 'true') returns integer language plpgsql as $$
declare n integer;
begin
  execute format('select count(*)::int from public.%I where %s', t, w) into n;
  return n;
exception when insufficient_privilege then return -1;
end $$;
-- rows a write statement touched as the CURRENT role; -1 = rejected (privilege / RLS / trigger)
create or replace function tests.touched(q text) returns integer language plpgsql as $$
declare n integer;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
exception when others then return -1;
end $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ================= 1. catalogue-driven invariants =================
select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
     from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity
      and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')),
  '', 'every public table has row level security enabled');

select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
     from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and c.relrowsecurity
      and not c.relispartition
      and not exists (select 1 from pg_policy p where p.polrelid = c.oid)),
  '', 'no RLS table is left without a policy (every table states who may read it)');

select is(
  (select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
     from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prosecdef
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) x where x like 'search_path=%')),
  '', 'every SECURITY DEFINER function pins its search_path');

-- A view runs with its owner's rights unless security_invoker is set, i.e. it bypasses RLS. Only
-- the two views that are DESIGNED as safe projections may do that.
select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
     from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'v'
      and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
      and not coalesce(c.reloptions::text[] @> array['security_invoker=true'], false)
      and c.relname not in ('public_profiles', 'world_open_garages')),
  '', 'no public view bypasses RLS except the two reviewed projections (public_profiles, world_open_garages)');

select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
     from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'm'
      and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select'))),
  '', 'no materialised view (no RLS possible) is readable through the API roles');

select is(
  (select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
     from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('admin_search_users', 'admin_set_suspension', 'admin_adjust_tokens',
                        'admin_pilot_kpis', 'admin_overview', 'refresh_pilot_kpis',
                        'run_h1_job', 'run_world_job')
      and has_function_privilege('anon', p.oid, 'execute')),
  '', 'anon holds EXECUTE on none of the admin / job RPCs');

-- RLS on a partitioned parent does not cover a partition addressed directly (S10 finding 5).
select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
     from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relispartition
      and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select')
        or has_table_privilege('anon', c.oid, 'insert') or has_table_privilege('authenticated', c.oid, 'insert'))),
  '', 'no partition is reachable by the API roles (the event log is read and written through its parent only)');

select ok(
  not has_column_privilege('anon', 'public.public_profiles', 'id', 'insert')
  and (select count(*) from information_schema.columns
        where table_schema = 'public' and table_name = 'public_profiles' and column_name in ('mobile', 'role', 'tokens')) = 0,
  'public_profiles exposes no mobile / role / token balance column');

-- ================= 2. behavioural matrix =================
insert into auth.users (id) values
  ('a1000000-0000-0000-0000-00000000000a'),
  ('a1000000-0000-0000-0000-00000000000b'),
  ('a1000000-0000-0000-0000-00000000000c'),
  ('a1000000-0000-0000-0000-00000000000d');
insert into public.profiles (id, display_name, account_type, handle, plan, role, mobile) values
  ('a1000000-0000-0000-0000-00000000000a', 'Owner', 'individual', 'mx_owner', 'free', 'user', '+971500001001'),
  ('a1000000-0000-0000-0000-00000000000b', 'Buyer', 'individual', 'mx_buyer', 'free', 'user', null),
  ('a1000000-0000-0000-0000-00000000000c', 'Stranger', 'individual', 'mx_stranger', 'free', 'user', null),
  ('a1000000-0000-0000-0000-00000000000d', 'Admin', 'individual', 'mx_admin', 'free', 'admin', null);
insert into public.collection_items (id, owner_id, brand, model, is_public, price_paid) values
  ('a1000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-00000000000a', 'Hot Wheels', 'Private car', false, 500),
  ('a1000000-0000-0000-0000-0000000000a2', 'a1000000-0000-0000-0000-00000000000a', 'Hot Wheels', 'Public car', true, 20);
insert into public.media (owner_id, kind, entity_id, bucket, path, status) values
  ('a1000000-0000-0000-0000-00000000000a', 'item', 'a1000000-0000-0000-0000-0000000000a1', 'item-media', 'a1000000-0000-0000-0000-00000000000a/a1/1.jpg', 'ready');
insert into public.ai_scan_jobs (user_id, kind, status, cost_usd) values ('a1000000-0000-0000-0000-00000000000a', 'single', 'done', 0.01);
insert into public.marketplace_listings (id, seller_id, brand, model, price, status, source_item_id) values
  ('a1000000-0000-0000-0000-0000000000b1', 'a1000000-0000-0000-0000-00000000000a', 'Hot Wheels', 'Public car', 100, 'active', 'a1000000-0000-0000-0000-0000000000a2');
insert into public.offers (id, listing_id, buyer_id, seller_id, type, amount, status) values
  ('a1000000-0000-0000-0000-0000000000c1', 'a1000000-0000-0000-0000-0000000000b1', 'a1000000-0000-0000-0000-00000000000b', 'a1000000-0000-0000-0000-00000000000a', 'cash', 110, 'accepted');
insert into public.deal_messages (offer_id, sender_id, body) values ('a1000000-0000-0000-0000-0000000000c1', 'a1000000-0000-0000-0000-00000000000a', 'hello');
insert into public.notifications (user_id, type) values ('a1000000-0000-0000-0000-00000000000a', 'system');
insert into public.token_ledger (user_id, delta, balance_after, reason) values ('a1000000-0000-0000-0000-00000000000a', 50, 50, 'admin_adjust');
insert into public.token_purchases (user_id, pack_id, amount, currency, status, paid_at)
  select 'a1000000-0000-0000-0000-00000000000a', id, 19, 'AED', 'paid', now() from public.token_packs limit 1;
insert into public.entitlement_grants (user_id, kind) select 'a1000000-0000-0000-0000-00000000000a', (enum_range(null::public.entitlement_grant_kind))[1];
insert into public.feedback (user_id, kind, message) values ('a1000000-0000-0000-0000-00000000000a', 'bug', 'matrix feedback');
insert into public.invites (code, cohort, max_uses) values ('MX-INVITE', 'matrix', 5);
insert into public.reports (target_type, target_id, reason, reporter_id) values ('listing', 'x', 'spam', 'a1000000-0000-0000-0000-00000000000a');
insert into public.blocks (blocker_id, blocked_id) values ('a1000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-00000000000c');
insert into public.wishlist_items (owner_id, brand, model) values ('a1000000-0000-0000-0000-00000000000a', 'Tomica', 'Wish');
insert into public.listing_favorites (user_id, listing_id) values ('a1000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-0000000000b1');
insert into public.user_achievements (user_id, achievement_key) select 'a1000000-0000-0000-0000-00000000000a', key from public.achievements limit 1;
insert into public.job_runs (job, triggered_by, run_at, status) values ('matrix_job', 'manual', now(), 'ok');

-- ---------- anon: nothing private, in any table ----------
select tests.authenticate_anon();
select is(tests.cnt('profiles'), 0, 'anon: profiles (PII) unreadable — public_profiles is the only door');
select is(tests.cnt('collection_items', 'not is_public'), 0, 'anon: private garage items hidden');
select is(tests.cnt('collection_items_v1'), -1, 'anon: the legacy collection_items_v1 view is not readable at all (S10 finding 1)');
select is(tests.cnt('media'), 0, 'anon: media of a private item hidden');
select is(tests.cnt('ai_scan_jobs'), 0, 'anon: scan jobs hidden');
select is(tests.cnt('offers'), 0, 'anon: offers hidden');
select is(tests.cnt('deal_messages'), 0, 'anon: deal chat hidden');
select is(tests.cnt('notifications'), 0, 'anon: notifications hidden');
select is(tests.cnt('token_ledger'), 0, 'anon: token ledger hidden');
select is(tests.cnt('token_purchases'), 0, 'anon: token purchases hidden');
select is(tests.cnt('entitlement_grants'), 0, 'anon: entitlement grants hidden');
select is(tests.cnt('feedback'), 0, 'anon: feedback hidden');
select is(tests.cnt('invites'), 0, 'anon: invite codes hidden');
select is(tests.cnt('reports'), 0, 'anon: reports hidden');
select is(tests.cnt('blocks'), 0, 'anon: blocks hidden');
select is(tests.cnt('wishlist_items'), 0, 'anon: wishlists hidden');
select is(tests.cnt('listing_favorites'), 0, 'anon: listing favourites hidden');
select is(tests.cnt('job_runs'), 0, 'anon: job log hidden');
select is(tests.cnt('domain_events'), 0, 'anon: event log hidden');
select is(tests.cnt('pilot_kpis_weekly'), -1, 'anon: no privilege on pilot_kpis_weekly');
select is(tests.cnt('marketplace_listings', $$id = 'a1000000-0000-0000-0000-0000000000b1'$$), 1, 'anon: an active listing IS public (browse works signed out)');
select is(tests.touched($$insert into public.feedback (user_id, kind, message) values ('a1000000-0000-0000-0000-00000000000a', 'bug', 'anon write')$$), -1, 'anon: cannot insert feedback');
select is(tests.touched($$insert into public.collection_items (owner_id, brand, model) values ('a1000000-0000-0000-0000-00000000000a', 'X', 'Y')$$), -1, 'anon: cannot insert a garage item');
select is(tests.touched($$update public.feature_flags set enabled = not enabled$$), 0, 'anon: cannot flip a feature flag');
select is(tests.touched($$delete from public.marketplace_listings$$), 0, 'anon: cannot delete listings');

-- ---------- an unrelated signed-in collector ----------
select tests.authenticate_as('a1000000-0000-0000-0000-00000000000c');
select is(tests.cnt('profiles', $$id <> 'a1000000-0000-0000-0000-00000000000c'$$), 0, 'stranger: cannot read another collector''s profiles row (mobile lives there)');
select is(tests.cnt('collection_items', 'not is_public'), 0, 'stranger: private garage items hidden');
select is(tests.cnt('collection_items_v1', 'not is_public'), 0, 'stranger: the legacy view now applies the caller''s RLS (S10 finding 1)');
select is(tests.cnt('media'), 0, 'stranger: media of a private item hidden');
select is(tests.cnt('ai_scan_jobs'), 0, 'stranger: scan jobs hidden');
select is(tests.cnt('offers'), 0, 'stranger: an offer between two other collectors is hidden');
select is(tests.cnt('deal_messages'), 0, 'stranger: their deal chat is hidden');
select is(tests.cnt('notifications'), 0, 'stranger: notifications hidden');
select is(tests.cnt('token_ledger'), 0, 'stranger: token ledger hidden');
select is(tests.cnt('token_purchases'), 0, 'stranger: token purchases hidden');
select is(tests.cnt('entitlement_grants'), 0, 'stranger: entitlement grants hidden');
select is(tests.cnt('feedback'), 0, 'stranger: feedback hidden');
select is(tests.cnt('invites'), 0, 'stranger: invite codes hidden (redeem_invite is the only door)');
select is(tests.cnt('reports'), 0, 'stranger: reports hidden');
select is(tests.cnt('blocks'), 0, 'stranger: cannot see who blocked them');
select is(tests.cnt('wishlist_items'), 0, 'stranger: wishlists hidden');
select is(tests.cnt('listing_favorites'), 0, 'stranger: listing favourites hidden');
select is(tests.cnt('job_runs'), 0, 'stranger: job log hidden');
select is(tests.cnt('domain_events'), 0, 'stranger: event log hidden');
select is(tests.touched($$update public.collection_items set model = 'hacked' where owner_id = 'a1000000-0000-0000-0000-00000000000a'$$), 0, 'stranger: cannot update another collector''s item');
select is(tests.touched($$delete from public.collection_items where owner_id = 'a1000000-0000-0000-0000-00000000000a'$$), 0, 'stranger: cannot delete another collector''s item');
select is(tests.touched($$update public.marketplace_listings set price = 1 where seller_id = 'a1000000-0000-0000-0000-00000000000a'$$), 0, 'stranger: cannot edit another seller''s listing');
select is(tests.touched($$update public.profiles set role = 'admin' where id = 'a1000000-0000-0000-0000-00000000000c'$$), -1, 'stranger: cannot make themselves admin');
select is(tests.touched($$update public.profiles set tokens = 9999 where id = 'a1000000-0000-0000-0000-00000000000c'$$), -1, 'stranger: cannot write their own token balance');
select is(tests.touched($$insert into public.token_ledger (user_id, delta, balance_after, reason) values ('a1000000-0000-0000-0000-00000000000c', 500, 500, 'promo')$$), -1, 'stranger: cannot insert a ledger credit (D-021)');
select is(tests.touched($$update public.offers set status = 'completed' where id = 'a1000000-0000-0000-0000-0000000000c1'$$), 0, 'stranger: cannot change an offer''s status (D-021)');
select is(tests.touched($$insert into public.invites (code, max_uses) values ('MX-SELF', 99)$$), -1, 'stranger: cannot mint an invite code');
select is(tests.touched($$insert into public.notifications (user_id, type) values ('a1000000-0000-0000-0000-00000000000a', 'system')$$), -1, 'stranger: cannot push a notification to someone');
select is(tests.touched($$update public.feature_flags set enabled = not enabled$$), 0, 'stranger: cannot flip a feature flag');
select is(tests.touched($$update public.token_packs set tokens = 1000000$$), 0, 'stranger: cannot edit token packs');
select is(tests.touched($$insert into public.job_runs (job, triggered_by, run_at) values ('fake_job', 'manual', now())$$), -1, 'stranger: cannot write the job log');
select throws_ok($$select * from public.admin_overview()$$, '42501', 'not_authorized', 'stranger: admin_overview() refuses a non-admin');
select throws_ok($$select * from public.admin_pilot_kpis(4)$$, '42501', 'not_authorized', 'stranger: admin_pilot_kpis() refuses a non-admin');
select throws_ok($$select public.refresh_pilot_kpis()$$, '42501', 'not_authorized', 'stranger: refresh_pilot_kpis() refuses a non-admin');

-- ---------- profiles: server-maintained columns (S10 finding 6) ----------
select throws_ok(
  $$update public.profiles set role = 'admin' where id = 'a1000000-0000-0000-0000-00000000000c'$$,
  '42501', 'profile_privileged_columns', 'a collector cannot promote themselves to admin');
select throws_ok(
  $$update public.profiles set plan = 'pro', pro_until = now() + interval '10 years' where id = 'a1000000-0000-0000-0000-00000000000c'$$,
  '42501', 'profile_privileged_columns', 'a collector cannot grant themselves Pro');
select throws_ok(
  $$update public.profiles set scan_quota_bonus = 1000 where id = 'a1000000-0000-0000-0000-00000000000c'$$,
  '42501', 'profile_privileged_columns', 'a collector cannot raise their own scan quota');
select lives_ok(
  $$update public.profiles set bio = 'still mine to edit', city = 'Dubai' where id = 'a1000000-0000-0000-0000-00000000000c'$$,
  'ordinary profile fields stay editable by their owner');
select tests.clear_authentication();
insert into auth.users (id) values ('a1000000-0000-0000-0000-00000000000e'), ('a1000000-0000-0000-0000-00000000000f');
select tests.authenticate_as('a1000000-0000-0000-0000-00000000000e');
select throws_ok(
  $$insert into public.profiles (id, display_name, account_type, handle, role, tokens) values ('a1000000-0000-0000-0000-00000000000e', 'Sneaky', 'individual', 'mx_sneaky', 'admin', 5000)$$,
  '42501', 'profile_privileged_columns', 'onboarding cannot create an admin / pre-funded profile');
select lives_ok(
  $$insert into public.profiles (id, display_name, account_type, handle) values ('a1000000-0000-0000-0000-00000000000e', 'Honest', 'individual', 'mx_honest')$$,
  'a normal onboarding insert still works');
select tests.clear_authentication();
select lives_ok(
  $$update public.profiles set tokens = 25, role = 'admin' where id = 'a1000000-0000-0000-0000-00000000000e'$$,
  'the database owner (migrations, psql, definer RPCs) is not subject to the guard');
update public.profiles set role = 'user' where id = 'a1000000-0000-0000-0000-00000000000e';
select tests.authenticate_as('a1000000-0000-0000-0000-00000000000d');
select lives_ok(
  $$select public.admin_adjust_tokens('a1000000-0000-0000-0000-00000000000b', 10, 'matrix')$$,
  'an admin''s definer RPC still moves a balance (the guard only stops direct API writes)');

-- ---------- the owner still reaches their own rows ----------
select tests.authenticate_as('a1000000-0000-0000-0000-00000000000a');
select is(
  (select array[tests.cnt('collection_items', 'not is_public'), tests.cnt('media'), tests.cnt('ai_scan_jobs'),
                tests.cnt('offers'), tests.cnt('deal_messages'), tests.cnt('notifications'), tests.cnt('token_ledger'),
                tests.cnt('token_purchases'), tests.cnt('entitlement_grants'), tests.cnt('reports'), tests.cnt('blocks'),
                tests.cnt('wishlist_items'), tests.cnt('listing_favorites')]),
  array[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  'owner: reads exactly their own row in each of the 13 private tables');
select is(tests.cnt('feedback'), 0, 'owner: feedback is write-only for collectors (admins read it)');

-- ---------- admin ----------
select tests.authenticate_as('a1000000-0000-0000-0000-00000000000d');
select is(
  (select array[tests.cnt('feedback'), tests.cnt('invites', $$code = 'MX-INVITE'$$), tests.cnt('reports'), tests.cnt('ai_scan_jobs')]),
  array[1, 1, 1, 1], 'admin: reads feedback, invites, reports and scan jobs');
select is(
  (select array[tests.cnt('collection_items', 'not is_public'), tests.cnt('offers'), tests.cnt('deal_messages'), tests.cnt('token_ledger')]),
  array[0, 0, 0, 0], 'admin: role does NOT open private garages, offers, deal chat or ledgers (RPCs are the door)');

-- ---------- the event log still works through its parent after the partition lock ----------
select tests.authenticate_as('a1000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$insert into public.domain_events (actor_id, type, entity) values ('a1000000-0000-0000-0000-00000000000a', 'user.opened', 'profile')$$,
  'a collector still logs their own event through the parent table');

-- ---------- rate limits (F-15 / F-19): reports and feedback, 10 per rolling 24 h ----------
select tests.clear_authentication();
insert into public.reports (target_type, target_id, reason, reporter_id)
  select 'listing', 'x' || g, 'spam', 'a1000000-0000-0000-0000-00000000000b' from generate_series(1, 10) g;
insert into public.feedback (user_id, kind, message)
  select 'a1000000-0000-0000-0000-00000000000b', 'idea', 'feedback ' || g from generate_series(1, 10) g;
select tests.authenticate_as('a1000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$insert into public.reports (target_type, target_id, reason, reporter_id) values ('listing', 'x11', 'spam', 'a1000000-0000-0000-0000-00000000000b')$$,
  'P0001', 'rate_limited', 'the 11th report in 24 h is refused on a DIRECT insert too (S10 finding 2)');
select throws_ok(
  $$insert into public.feedback (user_id, kind, message) values ('a1000000-0000-0000-0000-00000000000b', 'bug', 'eleventh')$$,
  'P0001', 'rate_limited', 'the 11th feedback in 24 h is refused (S10 finding 3)');
select tests.clear_authentication();

select * from finish();
rollback;
