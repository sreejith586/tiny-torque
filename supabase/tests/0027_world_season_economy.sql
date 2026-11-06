-- pgTAP for 0014c_world_season_economy (MV-W05-01…06 DB half, F-26/F-27/F-28, D-071, D-091).
-- Garage score: pure value, consumer-maintained on visits / kudos, replayable (zero + recompute =
-- the consumer's number, second run changes nothing); Spotlight: expiring consumable, one at a
-- time, `spend_spotlight`, surfaces on world_open_garages; season-limited items refuse outside
-- their window; earn freeze: admin-only RPC, earn_tokens pays nothing while frozen, audit events;
-- season track: milestones paid once by key, trophy + season.finished once; rollover: idempotent
-- season.started / season.ended; economy functions: admin/backend only, plain integers;
-- World badges seeded + gamification_events pays received kudos to the garage owner.
-- Reads of ledger / events / inventory run as admin (clear_authentication) where RLS would hide rows.

begin;
select plan(62);

insert into auth.users (id) values
  ('75000000-0000-0000-0000-00000000000a'),
  ('75000000-0000-0000-0000-00000000000b'),
  ('75000000-0000-0000-0000-00000000000c'),
  ('75000000-0000-0000-0000-00000000000d');
insert into public.profiles (id, display_name, account_type, handle, plan, role, tokens, level, country_code) values
  ('75000000-0000-0000-0000-00000000000a', 'Owner',   'individual', 'e_owner',   'free', 'user',  0, 1, 'AE'),
  ('75000000-0000-0000-0000-00000000000b', 'Visitor', 'individual', 'e_visitor', 'free', 'user',  0, 1, 'AE'),
  ('75000000-0000-0000-0000-00000000000c', 'Admin',   'individual', 'e_admin',   'free', 'admin', 0, 1, 'IN'),
  ('75000000-0000-0000-0000-00000000000d', 'Frozen',  'individual', 'e_frozen',  'free', 'user',  0, 1, 'IN');
insert into public.collection_items (id, owner_id, brand, model, rarity, is_public) values
  ('75000000-0000-0000-0000-0000000000a1', '75000000-0000-0000-0000-00000000000a', 'HW', 'Rare one', 'rare', true),
  ('75000000-0000-0000-0000-0000000000a2', '75000000-0000-0000-0000-00000000000a', 'HW', 'Private',  'chase', false);
-- Owner: level 1, one displayed rare car, one private car wrongly listed in a slot (ignored), one decor placed.
insert into public.world_garages (user_id, level, name, layout) values
  ('75000000-0000-0000-0000-00000000000a', 1, 'Owner garage',
   jsonb_build_object('version', 1,
     'slots', jsonb_build_array(jsonb_build_object('slot', 0, 'itemId', '75000000-0000-0000-0000-0000000000a1'),
                                jsonb_build_object('slot', 1, 'itemId', '75000000-0000-0000-0000-0000000000a2')),
     'decor', jsonb_build_array(jsonb_build_object('slot', 0, 'itemId', (select id from public.world_items where sku = 'decor_neon_sign')))));
insert into public.world_inventory (user_id, item_id, acquired_via, durable) values
  ('75000000-0000-0000-0000-00000000000a', (select id from public.world_items where sku = 'decor_neon_sign'), 'purchase', true);
update public.feature_flags set enabled = true where key in ('world', 'world_shop');
-- world_earn is switched on further down, after the social events: whichever daily quests today's
-- rotation offers must not pay the visitor while the score / Spotlight figures are being pinned.

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
create or replace function tests.authenticate_backend() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end; $$;
create or replace function tests.clear_authentication() returns void language plpgsql as $$
begin
  perform set_config('role', 'supabase_admin', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end; $$;
grant usage on schema tests to anon, authenticated, service_role;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- ---------- catalogue seed ----------
select ok((select count(*) from public.world_items where sku in
  ('theme_neon_workshop', 'decor_neon_sign', 'signage_welcome', 'tune_street', 'trophy_season_finisher', 'spotlight_24h')) = 6,
  'the placeholder launch catalogue is seeded across every kind');
select is((select price from public.world_items where sku = 'trophy_season_finisher'), null,
  'the season trophy is earned-only (price NULL)');
select is((select count(*)::int from public.achievements where key like 'world\_%'), 4, 'four World badges are seeded');

-- ---------- grants (07 P4): score / rollover / economy are never a client call ----------
select tests.authenticate_anon();
select throws_ok($$select public.world_recompute_score('75000000-0000-0000-0000-00000000000a')$$, '42501', null,
  'anon cannot recompute a score');
select tests.clear_authentication();
select tests.authenticate_as('75000000-0000-0000-0000-00000000000b');
select throws_ok($$select public.world_recompute_score('75000000-0000-0000-0000-00000000000a')$$, '42501', null,
  'a non-admin cannot recompute a score');
select throws_ok($$select public.world_recompute_all_scores()$$, '42501', null, 'a non-admin cannot run the nightly recompute');
select throws_ok($$select public.rollover_season()$$, '42501', null, 'a non-admin cannot roll a season over');
select throws_ok($$select public.admin_set_earn_freeze('75000000-0000-0000-0000-00000000000d', true)$$, '42501', null,
  'a non-admin cannot freeze earning');
select is((select count(*)::int from public.world_economy_summary()), 0, 'a non-admin sees no economy summary rows');
select is((select count(*)::int from public.world_economy_weekly(4)), 0, 'a non-admin sees no economy weekly rows');
select tests.clear_authentication();
select tests.authenticate_as('75000000-0000-0000-0000-00000000000a');
select throws_ok($$update public.world_garages set score = 999 where user_id = '75000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'score stays an RPC-only column (guard trigger)');
select tests.clear_authentication();

-- ---------- garage score: pure value over state (D-091 weights) ----------
-- 1 displayed car × 10 + rare (2) × 5 + 1 decor × 5 + level 1 → 25; the private car in slot 1 counts for nothing
select is(public.world_garage_score_value('75000000-0000-0000-0000-00000000000a'), 25,
  'score = displayed × 10 + rarity × 5 + decor × 5 (+ level); non-public slot entries are ignored');
select is((select score from public.world_garages where user_id = '75000000-0000-0000-0000-00000000000a'), 0,
  'the stored score is still 0 until an event recomputes it');

-- a visit (+1) and kudos (+2) through the W03 RPCs → the consumer writes 28 and logs the moves
select tests.authenticate_as('75000000-0000-0000-0000-00000000000b');
select public.ensure_world_garage();
select public.record_world_visit('75000000-0000-0000-0000-00000000000a');
select public.give_world_kudos('75000000-0000-0000-0000-00000000000a');
select tests.clear_authentication();
select is((select score from public.world_garages where user_id = '75000000-0000-0000-0000-00000000000a'), 28,
  'a visit (+1) and kudos (+2) move the stored score through the consumer (25 → 28)');
select is((select count(*)::int from public.domain_events where type = 'world.score_updated'
  and entity_id = '75000000-0000-0000-0000-00000000000a'), 2, 'world.score_updated is emitted per change');
select is((select payload ->> 'to' from public.domain_events where type = 'world.score_updated'
  and entity_id = '75000000-0000-0000-0000-00000000000a' order by id desc limit 1), '28',
  'the event carries the new score');

-- replay: zero it (through the guard GUC, as a migration would) + the nightly recompute = the same number
select set_config('mv.world_rpc', 'on', true);
update public.world_garages set score = 0 where user_id = '75000000-0000-0000-0000-00000000000a';
select set_config('mv.world_rpc', 'off', true);
select tests.authenticate_backend();
select is(public.world_recompute_all_scores(), 1, 'the nightly recompute reports one changed garage');
select is(public.world_recompute_all_scores(), 0, 'a second run changes nothing (idempotent)');
select tests.clear_authentication();
select is((select score from public.world_garages where user_id = '75000000-0000-0000-0000-00000000000a'), 28,
  'replay yields the consumer''s number (F-26 AC: same values after drop + replay)');
-- making the displayed car private drops it (and the slot-integrity consumer removes the slot)
update public.collection_items set is_public = false where id = '75000000-0000-0000-0000-0000000000a1';
select is((select score from public.world_garages where user_id = '75000000-0000-0000-0000-00000000000a'), 8,
  'a car made private leaves the score (28 → 8: decor 5 + kudos 2 + visit 1)');

-- ---------- Spotlight: expiring consumable, one at a time, spend_spotlight ----------
select tests.authenticate_backend();
select public.credit_tokens('75000000-0000-0000-0000-00000000000b', 60, 'purchase', 'token_purchase', null, 'e:b:pack');
select tests.clear_authentication();
select tests.authenticate_as('75000000-0000-0000-0000-00000000000b');
select lives_ok($$select public.buy_world_item((select id from public.world_items where sku = 'spotlight_24h'), 'e:b:spot1')$$,
  'a visitor buys a Spotlight');
select throws_ok($$select public.buy_world_item((select id from public.world_items where sku = 'spotlight_24h'), 'e:b:spot2')$$,
  'P0001', 'spotlight_active', 'a second Spotlight while one is active is refused');
select tests.clear_authentication();
select ok((select expires_at from public.world_inventory i join public.world_items w on w.id = i.item_id
  where i.user_id = '75000000-0000-0000-0000-00000000000b' and w.sku = 'spotlight_24h')
  between now() + interval '23 hours' and now() + interval '25 hours', 'the Spotlight row expires in 24 h');
select is((select reason::text || ':' || delta::text from public.token_ledger where idempotency_key = 'e:b:spot1'),
  'spend_spotlight:-20', 'the spend is posted as spend_spotlight at the item price');
select is((select count(*)::int from public.world_inventory i join public.world_items w on w.id = i.item_id
  where i.user_id = '75000000-0000-0000-0000-00000000000b' and w.sku = 'spotlight_24h'), 1, 'exactly one Spotlight row');
select isnt((select payload ->> 'expires_at' from public.domain_events where type = 'world.item_bought'
  and actor_id = '75000000-0000-0000-0000-00000000000b' order by id desc limit 1), null,
  'world.item_bought carries expires_at for a consumable');
select tests.authenticate_as('75000000-0000-0000-0000-00000000000a');
select isnt((select spotlight_until from public.world_open_garages where user_id = '75000000-0000-0000-0000-00000000000b'), null,
  'the open-garages view surfaces the active Spotlight');
select is((select spotlight_until from public.world_open_garages where user_id = '75000000-0000-0000-0000-00000000000a'), null,
  'garages without a Spotlight read null');
select tests.clear_authentication();
-- expired → gone from the view, a new one may be bought
update public.world_inventory set expires_at = now() - interval '1 minute'
  where user_id = '75000000-0000-0000-0000-00000000000b' and expires_at is not null;
select tests.authenticate_as('75000000-0000-0000-0000-00000000000b');
select is((select spotlight_until from public.world_open_garages where user_id = '75000000-0000-0000-0000-00000000000b'), null,
  'an expired Spotlight no longer shows');
select lives_ok($$select public.buy_world_item((select id from public.world_items where sku = 'spotlight_24h'), 'e:b:spot3')$$,
  'after expiry a new Spotlight can be bought');
select tests.clear_authentication();

-- ---------- season-limited items ----------
insert into public.seasons (id, name, theme, starts_at, ends_at) values
  ('75000000-0000-0000-0000-0000000000f1', 'Closed season',  'x', '2099-01-01 00:00+00', '2099-02-01 00:00+00'),
  ('75000000-0000-0000-0000-0000000000f2', 'Running season', 'y', now() - interval '1 day',   now() + interval '30 days');
insert into public.world_items (id, sku, kind, name, price, min_level, season_id, active) values
  ('75000000-0000-0000-0000-0000000000e1', 'e_closed_decor',  'decor', 'Closed decor',  5, 1, '75000000-0000-0000-0000-0000000000f1', true),
  ('75000000-0000-0000-0000-0000000000e2', 'e_running_decor', 'decor', 'Running decor', 5, 1, '75000000-0000-0000-0000-0000000000f2', true);
select tests.authenticate_as('75000000-0000-0000-0000-00000000000b');
select throws_ok($$select public.buy_world_item('75000000-0000-0000-0000-0000000000e1')$$, 'P0001', 'season_closed',
  'an item of a season that is not running cannot be bought');
select lives_ok($$select public.buy_world_item('75000000-0000-0000-0000-0000000000e2')$$,
  'an item of the running season can be bought');
select tests.clear_authentication();

-- ---------- earn freeze (F-26, 06 §5 "earn exploit") ----------
update public.feature_flags set enabled = true where key = 'world_earn';
select tests.authenticate_as('75000000-0000-0000-0000-00000000000c');
select is(public.admin_set_earn_freeze('75000000-0000-0000-0000-00000000000d', true, 'bot pattern'), true,
  'an admin freezes a user');
select tests.clear_authentication();
select is((select count(*)::int from public.domain_events where type = 'user.earn_frozen'
  and entity_id = '75000000-0000-0000-0000-00000000000d' and actor_id = '75000000-0000-0000-0000-00000000000c'), 1,
  'user.earn_frozen is logged with the admin as actor');
select tests.authenticate_backend();
select is((select public.earn_tokens('75000000-0000-0000-0000-00000000000d', 'earn_quest', 2, 'e:d:frozen')), null,
  'a frozen user earns nothing (NULL, nothing written)');
select tests.clear_authentication();
select is((select tokens from public.profiles where id = '75000000-0000-0000-0000-00000000000d'), 0, 'balance unchanged while frozen');
select tests.authenticate_as('75000000-0000-0000-0000-00000000000c');
select is(public.admin_set_earn_freeze('75000000-0000-0000-0000-00000000000d', false), false, 'the admin lifts the freeze');
select tests.clear_authentication();
select is((select count(*)::int from public.domain_events where type = 'user.earn_unfrozen'), 1, 'user.earn_unfrozen is logged');
select tests.authenticate_backend();
select is((select delta from public.earn_tokens('75000000-0000-0000-0000-00000000000d', 'earn_quest', 2, 'e:d:thawed')), 2,
  'after unfreezing the same user earns again');
select tests.clear_authentication();

-- ---------- season track: milestones paid once, trophy + season.finished once ----------
update public.seasons set track = '[{"points": 10, "reward_credits": 5, "label": "a"},
  {"points": 20, "reward_credits": 7, "label": "b", "reward_item_sku": "trophy_season_finisher"}]'::jsonb
  where id = '75000000-0000-0000-0000-0000000000f2';
insert into public.season_points (season_id, user_id, points) values
  ('75000000-0000-0000-0000-0000000000f2', '75000000-0000-0000-0000-00000000000d', 10);
select set_config('mv.earn_rpc', 'on', true);
select is(public.season_track_award('75000000-0000-0000-0000-00000000000d', '75000000-0000-0000-0000-0000000000f2'), 1,
  'reaching the first milestone pays it');
select is(public.season_track_award('75000000-0000-0000-0000-00000000000d', '75000000-0000-0000-0000-0000000000f2'), 0,
  'a second award call pays nothing more (keyed)');
select is((select delta from public.token_ledger where idempotency_key =
  'season:75000000-0000-0000-0000-0000000000f2:1:75000000-0000-0000-0000-00000000000d'), 5,
  'the milestone credit is an earn_season row under its key');
select is((select count(*)::int from public.domain_events where type = 'season.milestone_reached'
  and actor_id = '75000000-0000-0000-0000-00000000000d'), 1, 'season.milestone_reached once');
update public.season_points set points = 20 where user_id = '75000000-0000-0000-0000-00000000000d';
select is(public.season_track_award('75000000-0000-0000-0000-00000000000d', '75000000-0000-0000-0000-0000000000f2'), 1,
  'the last milestone pays once more');
select is(public.season_track_award('75000000-0000-0000-0000-00000000000d', '75000000-0000-0000-0000-0000000000f2'), 0,
  'and never again');
select set_config('mv.earn_rpc', 'off', true);
select is((select count(*)::int from public.world_inventory i join public.world_items w on w.id = i.item_id
  where i.user_id = '75000000-0000-0000-0000-00000000000d' and w.sku = 'trophy_season_finisher' and i.acquired_via = 'earn'), 1,
  'the season trophy is granted exactly once (earned-only, durable)');
select is((select count(*)::int from public.domain_events where type = 'season.finished'
  and actor_id = '75000000-0000-0000-0000-00000000000d'), 1, 'season.finished is emitted once');
select is((select tokens from public.profiles where id = '75000000-0000-0000-0000-00000000000d'), 14,
  'the user holds 2 (quest) + 5 + 7 (milestones) = 14');

-- ---------- rollover: idempotent, deterministic for a fixed p_at ----------
insert into public.seasons (id, name, theme, starts_at, ends_at) values
  ('75000000-0000-0000-0000-0000000000f3', 'Past',    'p', '2026-08-01 00:00+00', '2026-09-15 00:00+00'),
  ('75000000-0000-0000-0000-0000000000f4', 'Current', 'c', '2026-09-01 00:00+00', '2026-12-31 00:00+00');
select tests.authenticate_backend();
select is(public.rollover_season('2026-10-01 00:00+00'), '{"started": 2, "ended": 1}'::jsonb,
  'rollover announces the two seasons that started and closes the one that ended');
select is(public.rollover_season('2026-10-01 00:00+00'), '{"started": 0, "ended": 0}'::jsonb,
  'a second rollover at the same instant does nothing');
select tests.clear_authentication();
select is((select count(*)::int from public.domain_events where type = 'season.started'), 2, 'season.started twice');
select is((select payload ->> 'participants' from public.domain_events where type = 'season.ended'
  and entity_id = '75000000-0000-0000-0000-0000000000f3'), '0', 'season.ended carries the participant count');
select isnt((select closed_at from public.seasons where id = '75000000-0000-0000-0000-0000000000f3'), null, 'the ended season is stamped closed');
select is((select closed_at from public.seasons where id = '75000000-0000-0000-0000-0000000000f4'), null, 'the running season is not closed');

-- ---------- economy dashboard (admin): integers over source/reason, no second balance ----------
select tests.authenticate_as('75000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.world_economy_weekly(3)), 3, 'weekly returns one row per week asked');
select is((select spent from public.world_economy_weekly(1)), 45,
  'this week''s sinks = the two Spotlights (20 + 20) + the running-season decor (5)');
select is((select earned from public.world_economy_weekly(1)), 14, 'this week''s sources = 2 + 5 + 7 earned');
select is((select count(*)::int from public.world_economy_summary()), 10, 'the summary has its ten metrics');
select is((select value from public.world_economy_summary() where metric = 'world_active_users'), 2::numeric, 'two World-active garages');
select tests.clear_authentication();

-- ---------- World badges: received kudos pay the garage owner through gamification_events ----------
select tests.authenticate_as('75000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.gamification_events() where type = 'world.kudos_given'), 1,
  'the owner sees the kudos they received');
select tests.clear_authentication();
select tests.authenticate_as('75000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.gamification_events() where type = 'world.kudos_given'), 0,
  'the giver does not get paid for giving');
select is((select count(*)::int from public.gamification_events() where type = 'world.visited'), 1,
  'the visitor sees their own visit (First Visit badge)');
select tests.clear_authentication();

select * from finish();
rollback;
