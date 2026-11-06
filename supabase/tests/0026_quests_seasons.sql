-- pgTAP for 0014_quests_seasons + 0014b_earn_engine (MV-W04-01/07, F-26, D-070/D-071, D-013).
-- earn_tokens is not executable by anon/authenticated (nor credit_tokens / expire_earned_tokens),
-- the daily ceiling clips and then refuses, idempotency keys replay safely, spends are FIFO
-- earned-first with `consumed_earned` + `source` on the spend row, refunds debit purchased first,
-- earned credits older than 180 days expire exactly once, the domain_events consumer is dark while
-- `world_earn` is OFF and then pays daily login + the 7-day streak + quest completion, quest
-- progress is clamped and replayable (drop + replay_quest_progress = identical rows, no second
-- credit), and the 3 + 3 rotation is a pure function of the date. Run via CI's pgTAP job.
--
-- Reads of token_ledger / quest_progress / domain_events run as admin (clear_authentication)
-- where RLS would otherwise hide another user's rows.

begin;
select plan(59);

insert into auth.users (id) values
  ('74000000-0000-0000-0000-00000000000a'),
  ('74000000-0000-0000-0000-00000000000b'),
  ('74000000-0000-0000-0000-00000000000c'),
  ('74000000-0000-0000-0000-00000000000d');
insert into public.profiles (id, display_name, account_type, handle, plan, role, tokens, country_code) values
  ('74000000-0000-0000-0000-00000000000a', 'Earner',   'individual', 'q_earner',   'free', 'user', 0, 'AE'),
  ('74000000-0000-0000-0000-00000000000b', 'Spender',  'individual', 'q_spender',  'free', 'user', 0, 'AE'),
  ('74000000-0000-0000-0000-00000000000c', 'Streaker', 'individual', 'q_streaker', 'free', 'user', 0, 'IN'),
  ('74000000-0000-0000-0000-00000000000d', 'Quester',  'individual', 'q_quester',  'free', 'user', 0, 'IN');

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
-- The jobs runner / webhook: service-role JWT claims + the service_role database role.
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

-- ---------- grants: earning is never a client call (07 P4, D-071) ----------
select tests.authenticate_anon();
select throws_ok(
  $$select public.earn_tokens('74000000-0000-0000-0000-00000000000a', 'earn_quest', 2, 'k_anon')$$,
  '42501', null, 'anon cannot execute earn_tokens');
select tests.clear_authentication();
select tests.authenticate_as('74000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$select public.earn_tokens('74000000-0000-0000-0000-00000000000a', 'earn_quest', 2, 'k_auth')$$,
  '42501', null, 'authenticated cannot execute earn_tokens (F-26 AC)');
select throws_ok($$select public.expire_earned_tokens()$$, '42501', null,
  'authenticated cannot execute expire_earned_tokens');
select throws_ok(
  $$select public.credit_tokens('74000000-0000-0000-0000-00000000000a', 50, 'promo', null, null, 'k_cred')$$,
  '42501', null, 'authenticated cannot execute credit_tokens (0009 posture, now enforced)');
select throws_ok($$select public.replay_quest_progress('74000000-0000-0000-0000-00000000000b')$$, '42501', null,
  'a non-admin cannot replay quest progress');
select tests.clear_authentication();
select is((select tokens from public.profiles where id = '74000000-0000-0000-0000-00000000000a'), 0,
  'nothing was credited by the refused calls');

-- ---------- earn_tokens as the backend: source, event, idempotency, ceiling ----------
select tests.authenticate_backend();
select is((select delta from public.earn_tokens('74000000-0000-0000-0000-00000000000a', 'earn_quest', 10, 'q:a:1')),
  10, 'the service role earns 10');
select tests.clear_authentication();
select is((select source::text from public.token_ledger where idempotency_key = 'q:a:1'), 'earned',
  'the ledger row is source = earned');
select is(
  (select count(*)::int from public.domain_events e join public.token_ledger l on l.id = e.entity_id
     where e.type = 'tokens.earned' and l.idempotency_key = 'q:a:1'),
  1, 'tokens.earned is emitted for the credit');

select tests.authenticate_backend();
select is((select delta from public.earn_tokens('74000000-0000-0000-0000-00000000000a', 'earn_quest', 10, 'q:a:1')),
  10, 'replaying the same key returns the existing row');
select tests.clear_authentication();
select is((select count(*)::int from public.token_ledger where idempotency_key = 'q:a:1'), 1,
  'still exactly one row for the key');

select tests.authenticate_backend();
select is((select delta from public.earn_tokens('74000000-0000-0000-0000-00000000000a', 'earn_daily', 10, 'q:a:2')),
  5, 'a grant that would cross the daily ceiling (15) is clipped to the headroom');
select is((select public.earn_tokens('74000000-0000-0000-0000-00000000000a', 'earn_daily', 1, 'q:a:3')), null,
  'with no headroom left nothing is written and NULL returns');
select throws_ok(
  $$select public.earn_tokens('74000000-0000-0000-0000-00000000000a', 'purchase', 10, 'q:a:4')$$,
  'P0001', 'invalid_reason', 'earn_tokens accepts earn_* reasons only');
select tests.clear_authentication();
select is((select tokens from public.profiles where id = '74000000-0000-0000-0000-00000000000a'), 15,
  'the day stops at the ceiling');
select is((select sum(remaining)::int from public.token_ledger where user_id = '74000000-0000-0000-0000-00000000000a'),
  15, 'earned credits carry their full remaining');

-- ---------- FIFO earned-first spend (D-070), refund purchased-first ----------
select tests.authenticate_backend();
select public.earn_tokens('74000000-0000-0000-0000-00000000000b', 'earn_quest', 10, 'q:b:1');
select public.credit_tokens('74000000-0000-0000-0000-00000000000b', 50, 'purchase', 'token_purchase', null, 'q:b:pack');
select tests.clear_authentication();
select tests.authenticate_as('74000000-0000-0000-0000-00000000000b');
select public.spend_tokens('spend_listing_slot', 20, 'listing_slot', 1, null, null, null, 'q:b:spend1');
select tests.clear_authentication();
select is((select consumed_earned from public.token_ledger where idempotency_key = 'q:b:spend1'), 10,
  'a 20 spend with 10 earned available consumes the 10 earned first');
select is((select source::text from public.token_ledger where idempotency_key = 'q:b:spend1'), 'mixed',
  'the spend row is source = mixed');
select is((select remaining from public.token_ledger where idempotency_key = 'q:b:1'), 0,
  'the earned credit is fully consumed');
select is((select remaining from public.token_ledger where idempotency_key = 'q:b:pack'), 40,
  'the purchased credit covers the rest (50 → 40)');

select tests.authenticate_as('74000000-0000-0000-0000-00000000000b');
select public.spend_tokens('spend_listing_slot', 5, 'listing_slot', 1, null, null, null, 'q:b:spend2');
select tests.clear_authentication();
select is((select source::text || ':' || consumed_earned::text from public.token_ledger where idempotency_key = 'q:b:spend2'),
  'purchased:0', 'with no earned credits left a spend is source = purchased, consumed_earned = 0');
select is(
  (select sum(remaining)::int from public.token_ledger where user_id = '74000000-0000-0000-0000-00000000000b'),
  (select tokens from public.profiles where id = '74000000-0000-0000-0000-00000000000b'),
  'Σ remaining = cached balance after spends');

-- earn 5 more, then refund 10: the refund debits the purchased credit, the earned 5 stay
select tests.authenticate_backend();
select public.earn_tokens('74000000-0000-0000-0000-00000000000b', 'earn_daily', 5, 'q:b:2');
select public.credit_tokens('74000000-0000-0000-0000-00000000000b', -10, 'refund', 'token_purchase', null, 'q:b:refund');
select tests.clear_authentication();
select is((select remaining from public.token_ledger where idempotency_key = 'q:b:pack'), 25,
  'a refund consumes non-expiring credits first (35 → 25)');
select is((select remaining from public.token_ledger where idempotency_key = 'q:b:2'), 5,
  'the earned credit is untouched by the refund');
select is(
  (select sum(remaining)::int from public.token_ledger where user_id = '74000000-0000-0000-0000-00000000000b'),
  (select tokens from public.profiles where id = '74000000-0000-0000-0000-00000000000b'),
  'Σ remaining = cached balance after the refund');

-- ---------- expiry at 180 days: earned only, once ----------
update public.token_ledger set created_at = now() - interval '200 days' where idempotency_key in ('q:b:2', 'q:b:pack');
select tests.authenticate_backend();
select is(public.expire_earned_tokens(), 1, 'one earned credit older than 180 days expires');
select tests.clear_authentication();
select is(
  (select delta from public.token_ledger where user_id = '74000000-0000-0000-0000-00000000000b' and reason = 'expire_earned'),
  -5, 'the expire_earned debit is the unspent remainder');
select is(
  (select source::text from public.token_ledger where user_id = '74000000-0000-0000-0000-00000000000b' and reason = 'expire_earned'),
  'earned', 'the expiry row is attributed to earned');
select is(
  (select count(*)::int from public.domain_events e join public.token_ledger l on l.id = e.entity_id
     where e.type = 'tokens.expired' and l.user_id = '74000000-0000-0000-0000-00000000000b'),
  1, 'tokens.expired is emitted');
select is((select remaining from public.token_ledger where idempotency_key = 'q:b:2'), 0,
  'the expired credit has nothing left');
select is((select remaining from public.token_ledger where idempotency_key = 'q:b:pack'), 25,
  'a purchased credit of the same age never expires (D-070)');
select is((select tokens from public.profiles where id = '74000000-0000-0000-0000-00000000000b'), 25,
  'the balance reflects the expiry (30 → 25)');
select tests.authenticate_backend();
select is(public.expire_earned_tokens(), 0, 'a second run expires nothing (replay-safe)');
select tests.clear_authentication();
select is(
  (select sum(remaining)::int from public.token_ledger where user_id = '74000000-0000-0000-0000-00000000000b'),
  (select tokens from public.profiles where id = '74000000-0000-0000-0000-00000000000b'),
  'Σ remaining = cached balance after expiry');

-- ---------- consumer: dark while world_earn is OFF ----------
insert into public.domain_events (actor_id, type, entity, entity_id, payload, occurred_at) values
  ('74000000-0000-0000-0000-00000000000c', 'user.opened', 'profile', '74000000-0000-0000-0000-00000000000c', '{}',
   public.mv_utc_day_start(public.mv_utc_day(now()) - 10) + interval '8 hours');
select is(
  (select count(*)::int from public.token_ledger where user_id = '74000000-0000-0000-0000-00000000000c'),
  0, 'with world_earn OFF a user.opened earns nothing');

update public.feature_flags set enabled = true where key = 'world_earn';

-- ---------- consumer: daily login + 7-day streak (07 §3.2) ----------
-- six consecutive days before today, then today → streak 7 → +5 on top of the +1s
insert into public.domain_events (actor_id, type, entity, entity_id, payload, occurred_at)
select '74000000-0000-0000-0000-00000000000c', 'user.opened', 'profile', '74000000-0000-0000-0000-00000000000c', '{}',
       public.mv_utc_day_start(public.mv_utc_day(now()) - n) + interval '8 hours'
from generate_series(6, 1, -1) n;
select is(
  (select count(*)::int from public.token_ledger where user_id = '74000000-0000-0000-0000-00000000000c' and reason = 'earn_daily'),
  6, 'each past day paid its own earn_daily (+1, key per UTC day)');
insert into public.domain_events (actor_id, type, entity, entity_id, payload) values
  ('74000000-0000-0000-0000-00000000000c', 'user.opened', 'profile', '74000000-0000-0000-0000-00000000000c', '{}');
select tests.authenticate_backend();
select is(public.world_login_streak('74000000-0000-0000-0000-00000000000c'), 7, 'the login streak is 7');
select tests.clear_authentication();
select is(
  (select delta from public.token_ledger where user_id = '74000000-0000-0000-0000-00000000000c'
     and idempotency_key like 'streak7:%'),
  5, 'the 7th consecutive day pays the +5 streak bonus');
insert into public.domain_events (actor_id, type, entity, entity_id, payload) values
  ('74000000-0000-0000-0000-00000000000c', 'user.opened', 'profile', '74000000-0000-0000-0000-00000000000c', '{}');
select is((select tokens from public.profiles where id = '74000000-0000-0000-0000-00000000000c'), 12,
  'a second open the same day pays nothing more (7 × 1 + 5 = 12)');

-- ---------- rotation: a pure function of the date ----------
select is(public.quest_set_index('daily', date '2026-01-05'), 0, 'daily set 0 on the epoch Monday');
select is(public.quest_set_index('daily', date '2026-01-06'), 1, 'daily set 1 the next day');
select is(public.quest_set_index('weekly', date '2026-01-12'), 1, 'weekly set 1 the week after the epoch');
select is((select count(*)::int from public.current_quests()), 6, 'current_quests offers 3 daily + 3 weekly');
select is(
  (select array_agg(key order by sort_order) from public.current_quests('2026-01-05 12:00:00+00') where cadence = 'daily'),
  array['visit_garage', 'give_kudos', 'sign_guestbook'], 'daily set 0 = rows 1–3');
select is(
  (select array_agg(key order by sort_order) from public.current_quests('2026-01-12 12:00:00+00') where cadence = 'weekly'),
  array['weekly_guestbook', 'weekly_add_cars', 'weekly_garage_update'], 'weekly set 1 = rows 4–6');

-- ---------- consumer: quest progress, completion, reward, season points, clamping ----------
insert into public.seasons (id, name, theme, starts_at, ends_at) values
  ('74000000-0000-0000-0000-0000000000f0', 'Test season', 'test', now() - interval '1 day', now() + interval '1 day');
-- whichever world.visited daily quest today's set offers (visit_garage ×1 or visit_three ×3)
create temp table tq as
  select key, (rule->>'threshold')::int as threshold, reward_credits, reward_xp, period_start
  from public.current_quests() where cadence = 'daily' and rule->>'event' = 'world.visited';
select is((select count(*)::int from tq), 1, 'exactly one daily world.visited quest is on offer');
-- one statement per visit: AFTER ROW triggers of a multi-row insert all run after the whole
-- statement, so a single insert would show the consumer every row at once (no progressed steps)
do $$
declare i integer;
begin
  for i in 1..(select threshold from tq) loop
    insert into public.domain_events (actor_id, type, entity, entity_id, payload) values
      ('74000000-0000-0000-0000-00000000000d', 'world.visited', 'garage', '74000000-0000-0000-0000-00000000000a', '{}');
  end loop;
end $$;
select is(
  (select progress from public.quest_progress where user_id = '74000000-0000-0000-0000-00000000000d'
     and quest_key = (select key from tq) and period_start = (select period_start from tq)),
  (select threshold from tq), 'progress reaches the threshold');
select isnt(
  (select completed_at from public.quest_progress where user_id = '74000000-0000-0000-0000-00000000000d'
     and quest_key = (select key from tq)),
  null, 'the quest is completed');
select is(
  (select count(*)::int from public.domain_events where actor_id = '74000000-0000-0000-0000-00000000000d'
     and type = 'quest.completed' and payload->>'quest_key' = (select key from tq)),
  1, 'quest.completed is emitted once');
select is(
  (select count(*)::int from public.domain_events where actor_id = '74000000-0000-0000-0000-00000000000d'
     and type = 'quest.progressed' and payload->>'quest_key' = (select key from tq)),
  (select threshold - 1 from tq), 'quest.progressed is emitted for every step short of completion');
select is(
  (select delta from public.token_ledger where user_id = '74000000-0000-0000-0000-00000000000d' and reason = 'earn_quest'),
  (select reward_credits from tq), 'completion pays the quest''s reward_credits through earn_tokens');
select is(
  (select points from public.season_points where user_id = '74000000-0000-0000-0000-00000000000d'
     and season_id = '74000000-0000-0000-0000-0000000000f0'),
  (select reward_xp from tq), 'completion adds the quest''s reward_xp to the running season');

-- one more visit: clamped, no second completion, no second credit
insert into public.domain_events (actor_id, type, entity, entity_id, payload) values
  ('74000000-0000-0000-0000-00000000000d', 'world.visited', 'garage', '74000000-0000-0000-0000-00000000000a', '{}');
select is(
  (select progress from public.quest_progress where user_id = '74000000-0000-0000-0000-00000000000d'
     and quest_key = (select key from tq)),
  (select threshold from tq), 'progress is clamped at the threshold');
select is(
  (select count(*)::int from public.token_ledger where user_id = '74000000-0000-0000-0000-00000000000d' and reason = 'earn_quest'),
  1, 'a completed quest is paid exactly once');

-- ---------- replay: drop + rebuild from domain_events = identical rows, nothing re-credited ----------
create temp table snap as select * from public.quest_progress where user_id = '74000000-0000-0000-0000-00000000000d';
create temp table snap_points as select * from public.season_points where user_id = '74000000-0000-0000-0000-00000000000d';
select tests.authenticate_backend();
select ok(public.replay_quest_progress('74000000-0000-0000-0000-00000000000d') >= 1, 'replay rebuilds at least one row');
select tests.clear_authentication();
select is(
  (select count(*)::int from public.quest_progress where user_id = '74000000-0000-0000-0000-00000000000d'),
  (select count(*)::int from snap), 'replay yields the same number of progress rows');
select is(
  (select count(*)::int from public.quest_progress qp join snap s using (user_id, quest_key, period_start)
     where qp.progress = s.progress and qp.completed_at is not distinct from s.completed_at),
  (select count(*)::int from snap), 'every replayed row matches the consumer''s (progress + completed_at)');
select is(
  (select points from public.season_points where user_id = '74000000-0000-0000-0000-00000000000d'
     and season_id = '74000000-0000-0000-0000-0000000000f0'),
  (select points from snap_points where season_id = '74000000-0000-0000-0000-0000000000f0'),
  'replayed season points equal the consumer''s');
select is(
  (select count(*)::int from public.token_ledger where user_id = '74000000-0000-0000-0000-00000000000d'),
  1, 'replay moves no credits');

select * from finish();
rollback;
