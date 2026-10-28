-- pgTAP for the World purchase RPCs (MV-W01-05, F-27, D-021, 07 P4). ensure_world_garage
-- idempotency, buy_world_level's XP gate / price / max level / idempotent key, buy_world_item's
-- earned-only / min_level / durable-uniqueness / consumable rules, insufficient balance, the
-- events each emits, and that `authenticated` cannot bypass any of it. Run via CI's pgTAP job.
--
-- Reads of world_garages / world_inventory / token_ledger run as admin (clear_authentication)
-- where RLS would otherwise hide another user's rows; RPC return values are visible to the caller.

begin;
select plan(29);

insert into auth.users (id) values
  ('71000000-0000-0000-0000-00000000000a'),
  ('71000000-0000-0000-0000-00000000000b');
-- A: XP tier 1 (Rookie), no tokens.  B: XP tier 5 (Legend), rich. Tiers are 1-based (S8, D-079):
-- garage level n needs XP tier n (0013a re-aligned 0012's seed).
insert into public.profiles (id, display_name, account_type, handle, plan, role, tokens, level) values
  ('71000000-0000-0000-0000-00000000000a', 'Rookie', 'individual', 'r_rookie', 'free', 'user', 0, 1),
  ('71000000-0000-0000-0000-00000000000b', 'Legend', 'individual', 'r_legend', 'free', 'user', 0, 5);
insert into public.world_items (id, sku, kind, name, price, min_level, active) values
  ('71000000-0000-0000-0000-0000000000f0', 'r_lamp',     'decor',      'Lamp',      10,   1, true),
  ('71000000-0000-0000-0000-0000000000f1', 'r_trophy',   'trophy',     'Trophy',    null, 1, true),
  ('71000000-0000-0000-0000-0000000000f2', 'r_theme',    'theme',      'Theme',     25,   2, true),
  ('71000000-0000-0000-0000-0000000000f3', 'r_spot',     'consumable', 'Spotlight', 20,   1, true),
  ('71000000-0000-0000-0000-0000000000f4', 'r_retired',  'decor',      'Retired',   10,   1, false),
  ('71000000-0000-0000-0000-0000000000f5', 'r_free',     'signage',    'Free sign',  0,   1, true);

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
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------- anon cannot call anything ----------
select tests.authenticate_anon();
select throws_ok($$select public.ensure_world_garage()$$, '42501', null, 'anon cannot call ensure_world_garage');
select throws_ok($$select public.buy_world_level()$$, '42501', null, 'anon cannot call buy_world_level');

-- ---------- ensure_world_garage ----------
select tests.clear_authentication();
select tests.authenticate_as('71000000-0000-0000-0000-00000000000a');
select is((select level from public.ensure_world_garage()), 1, 'ensure_world_garage creates a level-1 garage');
select is((select name from public.ensure_world_garage()), 'Rookie''s Garage', 'the garage is named after the display name');
select tests.clear_authentication();
select is(
  (select count(*)::int from public.world_garages where user_id = '71000000-0000-0000-0000-00000000000a'),
  1, 'calling ensure twice yields exactly one garage'
);
select is(
  (select count(*)::int from public.domain_events where type = 'world.garage_created'
     and actor_id = '71000000-0000-0000-0000-00000000000a'),
  1, 'world.garage_created is emitted exactly once'
);

-- ---------- buy_world_level: XP gate before money ----------
select tests.authenticate_as('71000000-0000-0000-0000-00000000000a');
select throws_ok($$select public.buy_world_level()$$, 'P0001', 'xp_level_too_low',
  'level 2 needs XP tier 2 (Collector) — a rookie is refused even before the balance is checked');

-- give A tier 2 but no tokens → insufficient_balance; balance untouched.
-- profiles.xp/level are consumer-maintained (S8 guard trigger, D-079): a fixture write has to set
-- the same transaction-local flag apply_gamification() uses, exactly like the gamification tests.
select tests.clear_authentication();
select set_config('mv.gamification_write', '1', true);
update public.profiles set level = 2 where id = '71000000-0000-0000-0000-00000000000a';
select set_config('mv.gamification_write', '', true);
select tests.authenticate_as('71000000-0000-0000-0000-00000000000a');
select throws_ok($$select public.buy_world_level()$$, 'P0001', 'insufficient_balance',
  'a short balance is rejected by spend_tokens');
select tests.clear_authentication();
select is((select level from public.world_garages where user_id = '71000000-0000-0000-0000-00000000000a'),
  1, 'the garage level is unchanged after a rejected purchase');
select is((select tokens from public.profiles where id = '71000000-0000-0000-0000-00000000000a'),
  0, 'the balance is unchanged after a rejected purchase');

-- fund A with 100 and buy → level 2, 60 left, event + ledger row with the World reason
select public.credit_tokens('71000000-0000-0000-0000-00000000000a', 100, 'purchase', 'token_purchase', null, 'r_evt_1');
select tests.authenticate_as('71000000-0000-0000-0000-00000000000a');
select is((select level from public.buy_world_level()), 2, 'buy_world_level moves the garage to level 2');
select tests.clear_authentication();
select is((select tokens from public.profiles where id = '71000000-0000-0000-0000-00000000000a'),
  60, '40 tokens were spent (level 2 placeholder price)');
select is(
  (select count(*)::int from public.token_ledger where user_id = '71000000-0000-0000-0000-00000000000a'
     and reason = 'spend_garage_level' and delta = -40),
  1, 'the spend is a single token_ledger row with reason spend_garage_level'
);
select is(
  (select kind::text from public.entitlement_grants where user_id = '71000000-0000-0000-0000-00000000000a'),
  'world_level', 'the receipt is an entitlement grant of kind world_level'
);
select is(
  (select payload->>'to' from public.domain_events where type = 'world.level_up'
     and actor_id = '71000000-0000-0000-0000-00000000000a'),
  '2', 'world.level_up is emitted with the target level'
);

-- level 3 needs tier 3 → gated again (money alone cannot skip progression)
select tests.authenticate_as('71000000-0000-0000-0000-00000000000a');
select throws_ok($$select public.buy_world_level()$$, 'P0001', 'xp_level_too_low',
  'level 3 needs XP tier 3 — money alone cannot skip progression');

-- ---------- buy_world_level: climb to the top, then max_level ----------
select tests.clear_authentication();
select public.credit_tokens('71000000-0000-0000-0000-00000000000b', 1000, 'purchase', 'token_purchase', null, 'r_evt_2');
select tests.authenticate_as('71000000-0000-0000-0000-00000000000b');
select public.buy_world_level(); select public.buy_world_level(); select public.buy_world_level();
select is((select level from public.buy_world_level()), 5, 'four purchases take a tier-5 collector to level 5');
select throws_ok($$select public.buy_world_level()$$, 'P0001', 'max_level', 'level 5 is the top');
select tests.clear_authentication();
select is((select tokens from public.profiles where id = '71000000-0000-0000-0000-00000000000b'),
  1000 - 40 - 90 - 180 - 350, 'the four level steps cost exactly the placeholder prices');

-- ---------- buy_world_item ----------
select tests.authenticate_as('71000000-0000-0000-0000-00000000000a');
select is((select durable from public.buy_world_item('71000000-0000-0000-0000-0000000000f0')), true,
  'a decor item is bought as a durable inventory row');
select throws_ok($$select public.buy_world_item('71000000-0000-0000-0000-0000000000f0')$$, 'P0001', 'already_owned',
  'a durable item cannot be bought twice');
select throws_ok($$select public.buy_world_item('71000000-0000-0000-0000-0000000000f1')$$, 'P0001', 'earned_only',
  'an earned-only (price NULL) item is not purchasable');
select throws_ok($$select public.buy_world_item('71000000-0000-0000-0000-0000000000f4')$$, 'P0002', 'item_not_found',
  'an inactive item is not purchasable');
select is((select acquired_via::text from public.buy_world_item('71000000-0000-0000-0000-0000000000f5')), 'purchase',
  'a free (price 0) item is granted without a ledger row');
-- A is level 2 now, so the min_level-2 theme is allowed (25) → 60-10-25 = 25 left
select is((select durable from public.buy_world_item('71000000-0000-0000-0000-0000000000f2')), true,
  'a level-gated item is purchasable once the garage meets min_level');
-- consumable: 20 → 5 left; a second one is short
select is((select durable from public.buy_world_item('71000000-0000-0000-0000-0000000000f3', 'spot_1')), false,
  'a consumable is a non-durable inventory row');
select throws_ok($$select public.buy_world_item('71000000-0000-0000-0000-0000000000f3', 'spot_2')$$, 'P0001', 'insufficient_balance',
  'a consumable re-purchase with a short balance is rejected');
select tests.clear_authentication();
select is((select tokens from public.profiles where id = '71000000-0000-0000-0000-00000000000a'),
  5, 'item purchases deducted exactly 10 + 25 + 20');
select is(
  (select count(*)::int from public.domain_events where type = 'world.item_bought'
     and actor_id = '71000000-0000-0000-0000-00000000000a' and (payload->>'price')::int > 0),
  3, 'world.item_bought is emitted per paid purchase with the price paid'
);

select * from finish();
rollback;
