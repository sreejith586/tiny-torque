-- pgTAP for the World foundations migration (MV-W01-03, F-20, D-013). RLS matrix for
-- world_levels / world_items / world_garages / world_inventory across owner, follower, stranger,
-- blocked, anon and admin; the level/score guard trigger; the token_ledger.source derivation;
-- the profiles 18+/terms columns; and the eight world* flags seeded OFF. Run via CI's pgTAP job.

begin;
select plan(27);

insert into auth.users (id) values
  ('70000000-0000-0000-0000-00000000000a'),
  ('70000000-0000-0000-0000-00000000000b'),
  ('70000000-0000-0000-0000-00000000000c'),
  ('70000000-0000-0000-0000-00000000000d'),
  ('70000000-0000-0000-0000-00000000000e');
insert into public.profiles (id, display_name, account_type, handle, plan, role, tokens) values
  ('70000000-0000-0000-0000-00000000000a', 'Owner',    'individual', 'w_owner',    'free', 'user',  0),
  ('70000000-0000-0000-0000-00000000000b', 'Followed', 'individual', 'w_followed', 'free', 'user',  0),
  ('70000000-0000-0000-0000-00000000000c', 'Stranger', 'individual', 'w_stranger', 'free', 'user',  0),
  ('70000000-0000-0000-0000-00000000000d', 'Admin',    'individual', 'w_admin',    'free', 'admin', 0),
  ('70000000-0000-0000-0000-00000000000e', 'Blocker',  'individual', 'w_blocker',  'free', 'user',  0);

-- Garages (inserted as admin — there is deliberately no client insert path):
--   A public · B followers-only · C invite-only · E public but E has blocked A
insert into public.world_garages (user_id, level, name, open_mode) values
  ('70000000-0000-0000-0000-00000000000a', 1, 'A garage', 'public'),
  ('70000000-0000-0000-0000-00000000000b', 1, 'B garage', 'followers'),
  ('70000000-0000-0000-0000-00000000000c', 1, 'C garage', 'invite'),
  ('70000000-0000-0000-0000-00000000000e', 1, 'E garage', 'public');
insert into public.follows (follower_id, followee_id) values
  ('70000000-0000-0000-0000-00000000000a', '70000000-0000-0000-0000-00000000000b');
insert into public.blocks (blocker_id, blocked_id) values
  ('70000000-0000-0000-0000-00000000000e', '70000000-0000-0000-0000-00000000000a');
insert into public.world_items (id, sku, kind, name, price, min_level, active) values
  ('70000000-0000-0000-0000-0000000000f0', 't_lamp',   'decor',  'Lamp',   10, 1, true),
  ('70000000-0000-0000-0000-0000000000f1', 't_hidden', 'decor',  'Hidden', 10, 1, false);
insert into public.world_inventory (user_id, item_id, acquired_via) values
  ('70000000-0000-0000-0000-00000000000a', '70000000-0000-0000-0000-0000000000f0', 'promo');

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
-- SECURITY INVOKER on purpose: runs as whoever is authenticated when called. In CI (tables
-- created by supabase_admin, no default privileges) anon gets `permission denied`; on a hosted
-- project (20260928000000_grants.sql default privileges) anon has SELECT and RLS yields 0 rows.
-- Both mean "anon sees nothing", which is what the assertion is about.
create or replace function tests.visible_inventory_rows() returns integer language plpgsql as $$
declare n integer;
begin
  select count(*) into n from public.world_inventory;
  return n;
exception when insufficient_privilege then
  return 0;
end; $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------- schema ----------
select has_column('public', 'profiles', 'age_confirmed_at', 'profiles.age_confirmed_at exists (18+ gate, P8)');
select has_column('public', 'profiles', 'terms_version', 'profiles.terms_version exists');
select has_column('public', 'token_ledger', 'source', 'token_ledger.source exists (07 §3.1)');
select ok(
  'spend_garage_level' = any (enum_range(null::public.token_ledger_reason)::text[])
  and 'earn_quest' = any (enum_range(null::public.token_ledger_reason)::text[]),
  'token_ledger_reason gained the World earn/spend values'
);
select is((select count(*)::int from public.world_levels), 5, 'five garage levels are seeded');
select is(
  (select count(*)::int from public.feature_flags where key like 'world%' and enabled = false),
  8, 'all eight world* flags are seeded OFF'
);

-- ---------- anon ----------
select tests.authenticate_anon();
select is((select count(*)::int from public.world_levels), 5, 'anon reads the level table');
select is((select count(*)::int from public.world_items), 1, 'anon sees only active items');
select is((select count(*)::int from public.world_garages), 2, 'anon sees exactly the public garages (A, E)');
select is(tests.visible_inventory_rows(), 0, 'anon sees no inventory');

-- ---------- owner A: own + followed B; not invite-only C; not E (E blocked A) ----------
select tests.clear_authentication();
select tests.authenticate_as('70000000-0000-0000-0000-00000000000a');
select is(
  (select string_agg(name, ',' order by name) from public.world_garages),
  'A garage,B garage', 'A sees own garage + the followers-only garage they follow, not invite-only C, not blocker E'
);
select is((select count(*)::int from public.world_inventory), 1, 'owner reads their own inventory');
select throws_ok(
  $$insert into public.world_garages (user_id, name) values ('70000000-0000-0000-0000-00000000000c', 'x')$$,
  '42501', null, 'authenticated cannot insert a garage directly (RPC only)'
);
select throws_ok(
  $$insert into public.world_inventory (user_id, item_id, acquired_via) values ('70000000-0000-0000-0000-00000000000a', '70000000-0000-0000-0000-0000000000f0', 'purchase')$$,
  '42501', null, 'authenticated cannot insert inventory directly (RPC/consumer only)'
);
select lives_ok(
  $$update public.world_garages set name = 'A renamed', open_mode = 'followers' where user_id = '70000000-0000-0000-0000-00000000000a'$$,
  'owner can edit name/open_mode'
);
select throws_ok(
  $$update public.world_garages set level = 5 where user_id = '70000000-0000-0000-0000-00000000000a'$$,
  '42501', 'level_or_score_rpc_only', 'owner cannot bump their own level directly (guard trigger)'
);
select throws_ok(
  $$update public.world_garages set score = 999 where user_id = '70000000-0000-0000-0000-00000000000a'$$,
  '42501', 'level_or_score_rpc_only', 'owner cannot set their own score directly (guard trigger)'
);
-- an update aimed at someone else's row silently affects 0 rows under RLS
update public.world_garages set name = 'hacked' where user_id = '70000000-0000-0000-0000-00000000000b';
select tests.clear_authentication();
select is(
  (select name from public.world_garages where user_id = '70000000-0000-0000-0000-00000000000b'),
  'B garage', 'a user cannot rename another user''s garage'
);
select is(
  (select name from public.world_garages where user_id = '70000000-0000-0000-0000-00000000000a'),
  'A renamed', 'the owner''s own rename did land'
);
-- restore A to public for the stranger checks below
update public.world_garages set open_mode = 'public' where user_id = '70000000-0000-0000-0000-00000000000a';

-- ---------- stranger C: own + public A + public E; not followers-only B ----------
select tests.authenticate_as('70000000-0000-0000-0000-00000000000c');
select is(
  (select string_agg(name, ',' order by name) from public.world_garages),
  'A renamed,C garage,E garage', 'a stranger sees public garages + their own, not a followers-only one'
);
select is((select count(*)::int from public.world_inventory), 0, 'a stranger cannot read another user''s inventory');

-- ---------- blocker E: does not see A either (blocks are symmetric) ----------
select tests.clear_authentication();
select tests.authenticate_as('70000000-0000-0000-0000-00000000000e');
select is(
  (select count(*)::int from public.world_garages where user_id = '70000000-0000-0000-0000-00000000000a'),
  0, 'the blocker does not see the blocked user''s public garage (symmetric)'
);

-- ---------- admin D: everything ----------
select tests.clear_authentication();
select tests.authenticate_as('70000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.world_garages), 4, 'admin sees every garage');
select is((select count(*)::int from public.world_items), 2, 'admin sees inactive items too');
select is((select count(*)::int from public.world_inventory), 1, 'admin reads inventory');

-- ---------- token_ledger.source is derived from the reason ----------
select tests.clear_authentication();
select is(
  (select source::text from public.credit_tokens(
    '70000000-0000-0000-0000-00000000000a', 50, 'purchase', 'token_purchase', null, 'w_evt_1')),
  'purchased', 'a purchase credit is tagged source=purchased'
);
select is(
  (select source::text from public.credit_tokens(
    '70000000-0000-0000-0000-00000000000a', 5, 'admin_adjust', 'goodwill', null, 'w_evt_2')),
  'adjust', 'an admin adjustment is tagged source=adjust'
);

select * from finish();
rollback;
