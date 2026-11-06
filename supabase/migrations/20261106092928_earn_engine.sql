-- 0014b_earn_engine — MV-W04-01/02/03/04/07 (DB half), F-26, 07 §3.2–§3.3 / §6.2, D-070 / D-071,
-- 03 §3 (earn_tokens, expire_earned_tokens, FIFO spend_tokens, world_earn_consumer).
--
-- The earn engine. Credits are never a client call (07 P4 / D-071): earn_tokens() is SECURITY
-- DEFINER with EXECUTE revoked from anon/authenticated — only the service role (jobs) and the
-- domain_events consumer trigger (which flags itself with a transaction-local GUC) can reach it,
-- and the daily ceiling (PLACEHOLDER 15, 07 §3.2) + idempotency key live inside it. Earned credits
-- expire after 180 days (expire_earned_tokens(), D-070) and are spent FIFO before purchased ones
-- (spend_tokens replaced, same signature — D-006: a new file, never an edit to 0009's).
-- 0012's enum additions ('mixed' from the previous file) are referenced here, a transaction later.

-- ---------- feature-flag check usable from triggers (mirrors src/domain/flags/evaluate.ts) ----------
-- Same 32-bit string hash as stableBucket() so a percent rollout buckets a user identically in SQL
-- and TS. Inputs are uuids (ASCII), so ascii() == charCodeAt().
create or replace function public.mv_stable_bucket(p_input text) returns integer
language plpgsql immutable as $$
declare
  h bigint := 0;
  i integer;
begin
  for i in 1..coalesce(length(p_input), 0) loop
    h := (h << 5) - h + ascii(substr(p_input, i, 1));
    h := ((h + 2147483648) % 4294967296 + 4294967296) % 4294967296 - 2147483648; -- JS `|= 0`
  end loop;
  return (abs(h) % 100)::integer;
end; $$;

-- enabled is the kill switch; user_ids is an allowlist override; plans / countries / percent AND
-- together; an empty audience matches everyone. Unknown flag = OFF (D-018).
create or replace function public.mv_flag_active(p_key text, p_user uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  f  public.feature_flags;
  pr public.profiles;
  a  jsonb;
begin
  select * into f from public.feature_flags where key = p_key;
  if not found or not f.enabled then return false; end if;
  a := coalesce(f.audience, '{}'::jsonb);
  if p_user is not null and a ? 'user_ids' and a->'user_ids' @> to_jsonb(p_user::text) then return true; end if;
  select * into pr from public.profiles where id = p_user;
  if jsonb_array_length(coalesce(a->'plans', '[]'::jsonb)) > 0
     and not (a->'plans' @> to_jsonb(coalesce(pr.plan::text, ''))) then return false; end if;
  if jsonb_array_length(coalesce(a->'countries', '[]'::jsonb)) > 0
     and not (a->'countries' @> to_jsonb(coalesce(pr.country_code, ''))) then return false; end if;
  if jsonb_typeof(a->'percent') = 'number' then
    if p_user is null or public.mv_stable_bucket(p_user::text) >= (a->>'percent')::numeric then return false; end if;
  end if;
  return true;
end; $$;

-- ---------- UTC day helpers (every period here is a UTC day/week, same as F-13's utcDay) ----------
create or replace function public.mv_utc_day(p_at timestamptz) returns date
language sql immutable as $$ select (p_at at time zone 'utc')::date $$;

create or replace function public.mv_utc_day_start(p_day date) returns timestamptz
language sql immutable as $$ select p_day::timestamp at time zone 'utc' $$;

-- ---------- token_consume_fifo: the FIFO allocator (07 §3.3, D-070) ----------
-- Walks the user's credit rows with remaining > 0, oldest first within the preferred class
-- (earned first for spends; non-expiring first for refunds / negative adjustments, so a refunded
-- pack is what gets debited), and decrements `remaining`. Returns how much came from earned
-- credits. Consumes what exists and no more — a refund may still take the balance negative
-- (D-065); the next credit then pays that debt before becoming spendable (see credit_tokens).
create or replace function public.token_consume_fifo(p_user uuid, p_amount integer, p_earned_first boolean)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_left   integer := p_amount;
  v_earned integer := 0;
  v_take   integer;
  r record;
begin
  if p_amount <= 0 then return 0; end if;
  for r in
    select id, remaining, source from public.token_ledger
    where user_id = p_user and delta > 0 and remaining > 0
    order by (case when (source = 'earned') = p_earned_first then 0 else 1 end), created_at, id
    for update
  loop
    exit when v_left <= 0;
    v_take := least(r.remaining, v_left);
    update public.token_ledger set remaining = remaining - v_take where id = r.id;
    v_left := v_left - v_take;
    if r.source = 'earned' then v_earned := v_earned + v_take; end if;
  end loop;
  return v_earned;
end; $$;
revoke execute on function public.token_consume_fifo(uuid, integer, boolean) from public, anon, authenticated;

-- ---------- credit_tokens: same signature as 0009, now FIFO-aware + the World event names ----------
-- Credits set `remaining` (a credit first pays off a negative balance; only the rest is spendable).
-- Debits through this path (refund, negative admin_adjust) consume non-expiring credits first.
-- `expire_earned` rows are written by expire_earned_tokens(), which zeroes its own source row.
-- Event: purchase → tokens.purchased, refund → tokens.refunded, earn_* → tokens.earned,
-- expire_earned → tokens.expired, else tokens.adjusted (0009 emitted tokens.adjusted for every
-- non-purchase/refund reason, which would have mislabelled every earn).
create or replace function public.credit_tokens(
  p_user     uuid,
  p_delta    integer,
  p_reason   public.token_ledger_reason,
  p_ref_type text default null,
  p_ref_id   uuid default null,
  p_key      text default null
)
returns public.token_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance   integer;
  v_ledger    public.token_ledger;
  v_event     text;
  v_remaining integer;
  v_consumed  integer;
begin
  if p_delta = 0 then raise exception 'invalid_delta' using errcode = 'P0001'; end if;

  if p_key is not null then
    select * into v_ledger from public.token_ledger where idempotency_key = p_key;
    if found then return v_ledger; end if;
  end if;

  select tokens into v_balance from public.profiles where id = p_user for update;
  if not found then raise exception 'user_not_found' using errcode = 'P0002'; end if;

  if p_delta > 0 then
    v_remaining := greatest(0, least(p_delta, v_balance + p_delta));
  elsif p_reason = 'expire_earned' then
    v_consumed := -p_delta;
  else
    v_consumed := public.token_consume_fifo(p_user, -p_delta, false);
  end if;

  insert into public.token_ledger (user_id, delta, balance_after, reason, ref_type, ref_id, idempotency_key, remaining, consumed_earned)
    values (p_user, p_delta, v_balance + p_delta, p_reason, p_ref_type, p_ref_id, p_key, v_remaining, v_consumed)
    returning * into v_ledger;

  v_event := case
    when p_reason = 'purchase' then 'tokens.purchased'
    when p_reason = 'refund' then 'tokens.refunded'
    when p_reason::text like 'earn\_%' then 'tokens.earned'
    when p_reason = 'expire_earned' then 'tokens.expired'
    else 'tokens.adjusted'
  end;
  insert into public.domain_events (actor_id, type, entity, entity_id, payload)
    values (p_user, v_event, 'token', v_ledger.id, jsonb_build_object('reason', p_reason, 'delta', p_delta));

  return v_ledger;
end; $$;
-- 0009 documented credit_tokens as service-role/definer-only but never revoked the default PUBLIC
-- EXECUTE; make the documented posture true (the webhook keeps its service-role grant).
revoke execute on function public.credit_tokens(uuid, integer, public.token_ledger_reason, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.credit_tokens(uuid, integer, public.token_ledger_reason, text, uuid, text)
  to service_role;

-- ---------- spend_tokens: same signature as 0009, FIFO earned-first (D-070) ----------
-- Everything 0009 did (lock, balance check, ledger row, entitlement grant, pro_until, events) plus:
-- the cost is allocated earned-first via token_consume_fifo, the spend row records `consumed_earned`
-- and gets `source` = earned (all from earned) / purchased (none from earned — purchased, promo or
-- adjust credits) / mixed. 0012 left spends NULL "until W04's FIFO"; this is that.
create or replace function public.spend_tokens(
  p_reason     public.token_ledger_reason,
  p_cost       integer,
  p_grant_kind public.entitlement_grant_kind,
  p_quantity   integer default 1,
  p_expires_at timestamptz default null,
  p_ref_type   text default null,
  p_ref_id     uuid default null,
  p_key        text default null
)
returns public.entitlement_grants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_balance  integer;
  v_ledger   public.token_ledger;
  v_grant    public.entitlement_grants;
  v_consumed integer;
  v_source   public.token_ledger_source;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_cost <= 0 then raise exception 'invalid_cost' using errcode = 'P0001'; end if;

  if p_key is not null then
    select * into v_ledger from public.token_ledger where idempotency_key = p_key;
    if found then
      select * into v_grant from public.entitlement_grants where ledger_id = v_ledger.id;
      if found then return v_grant; end if;
    end if;
  end if;

  select tokens into v_balance from public.profiles where id = v_uid for update;
  if v_balance < p_cost then raise exception 'insufficient_balance' using errcode = 'P0001'; end if;

  v_consumed := public.token_consume_fifo(v_uid, p_cost, true);
  v_source := case
    when v_consumed >= p_cost then 'earned'::public.token_ledger_source
    when v_consumed = 0 then 'purchased'::public.token_ledger_source
    else 'mixed'::public.token_ledger_source
  end;

  insert into public.token_ledger (user_id, delta, balance_after, reason, ref_type, ref_id, idempotency_key, source, consumed_earned)
    values (v_uid, -p_cost, v_balance - p_cost, p_reason, p_ref_type, p_ref_id, p_key, v_source, v_consumed)
    returning * into v_ledger;

  insert into public.entitlement_grants (user_id, kind, quantity, expires_at, ledger_id)
    values (v_uid, p_grant_kind, p_quantity, p_expires_at, v_ledger.id)
    returning * into v_grant;

  if p_grant_kind = 'pro_30d' then
    update public.profiles
      set pro_until = greatest(coalesce(pro_until, now()), now()) + (p_quantity * interval '30 days')
      where id = v_uid;
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (v_uid, 'pro.activated', 'profile', v_uid, jsonb_build_object('days', p_quantity * 30));
  end if;

  insert into public.domain_events (actor_id, type, entity, entity_id, payload)
    values (v_uid, 'tokens.spent', 'token', v_ledger.id,
            jsonb_build_object('reason', p_reason, 'cost', p_cost, 'consumed_earned', v_consumed, 'source', v_source));

  return v_grant;
end; $$;
-- (the 0009 grant to authenticated stays in force — same signature, same object)

-- ---------- earn_tokens: the only way credits are earned (07 P4, D-071) ----------
-- Callable by the service role (jobs runner) or from the consumer trigger below, which sets the
-- transaction-local `mv.earn_rpc` GUC right before calling. EXECUTE is revoked from anon /
-- authenticated, so the GUC is belt-and-braces, not the gate. p_key is mandatory (rule + user +
-- period, e.g. 'quest:visit_garage:<uid>:2026-11-06'); a replay returns the existing row.
-- Daily ceiling: Σ positive earn_* deltas credited today (UTC) may not exceed 15 (PLACEHOLDER,
-- 07 §3.2 — a constant here, not a price row; changing it is a one-line migration). A grant that
-- would cross it is clipped to the headroom; with no headroom nothing is written and NULL returns.
create or replace function public.earn_tokens(
  p_user   uuid,
  p_reason public.token_ledger_reason,
  p_amount integer,
  p_key    text
)
returns public.token_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  c_ceiling   constant integer := 15;
  v_today     integer;
  v_amount    integer;
  v_ledger    public.token_ledger;
begin
  if not (public.mv_is_backend_caller() or current_setting('mv.earn_rpc', true) = 'on') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_user is null or coalesce(p_key, '') = '' then raise exception 'invalid_key' using errcode = 'P0001'; end if;
  if p_reason::text not like 'earn\_%' then raise exception 'invalid_reason' using errcode = 'P0001'; end if;
  if p_amount <= 0 then raise exception 'invalid_amount' using errcode = 'P0001'; end if;

  select * into v_ledger from public.token_ledger where idempotency_key = p_key;
  if found then return v_ledger; end if;

  perform 1 from public.profiles where id = p_user for update;
  if not found then raise exception 'user_not_found' using errcode = 'P0002'; end if;

  select coalesce(sum(delta), 0) into v_today from public.token_ledger
    where user_id = p_user and delta > 0 and reason::text like 'earn\_%'
      and created_at >= public.mv_utc_day_start(public.mv_utc_day(now()));
  v_amount := least(p_amount, c_ceiling - v_today);
  if v_amount <= 0 then return null; end if;

  return public.credit_tokens(p_user, v_amount, p_reason, 'earn', null, p_key);
end; $$;
revoke execute on function public.earn_tokens(uuid, public.token_ledger_reason, integer, text)
  from public, anon, authenticated;
grant execute on function public.earn_tokens(uuid, public.token_ledger_reason, integer, text) to service_role;

-- ---------- expire_earned_tokens: the 180-day expiry job (07 §3.3, D-070) ----------
-- For every earned credit older than 180 days with something left, posts one `expire_earned` debit
-- for the remainder (key 'expire:<ledger id>', so a crashed run resumes without a double debit) and
-- zeroes the source row. Purchased / promo / adjust credits never expire. Returns rows expired;
-- a second run returns 0. Service role only — the jobs runner's call (W04-04 wires the schedule
-- and the T-14 d notice).
create or replace function public.expire_earned_tokens()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count integer := 0;
begin
  if not public.mv_is_backend_caller() then raise exception 'not_authorized' using errcode = '42501'; end if;
  for r in
    select id, user_id, remaining from public.token_ledger
    where delta > 0 and source = 'earned' and remaining > 0
      and created_at < now() - interval '180 days'
    order by created_at, id
    for update skip locked
  loop
    perform public.credit_tokens(r.user_id, -r.remaining, 'expire_earned', 'token_ledger', r.id, 'expire:' || r.id::text);
    update public.token_ledger set remaining = 0 where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;
revoke execute on function public.expire_earned_tokens() from public, anon, authenticated;
grant execute on function public.expire_earned_tokens() to service_role;

-- ---------- quest periods + the rotating set (pure functions of the date) ----------
create or replace function public.quest_period_start(p_cadence public.quest_cadence, p_at timestamptz)
returns date language sql immutable as $$
  select case p_cadence
    when 'daily' then public.mv_utc_day(p_at)
    else date_trunc('week', p_at at time zone 'utc')::date   -- Monday
  end
$$;

create or replace function public.quest_period_end(p_cadence public.quest_cadence, p_start date)
returns date language sql immutable as $$
  select case p_cadence when 'daily' then p_start + 1 else p_start + 7 end
$$;

-- 0 or 1: which half of the pool (rows 1–3 or 4–6) a period shows. Epoch = Monday 2026-01-05 so
-- weekly parity is stable across the year boundary.
create or replace function public.quest_set_index(p_cadence public.quest_cadence, p_start date)
returns integer language sql immutable as $$
  select case p_cadence
    when 'daily' then mod(mod(p_start - date '2026-01-05', 2) + 2, 2)
    else mod(mod((p_start - date '2026-01-05') / 7, 2) + 2, 2)
  end
$$;

-- The quests on offer at p_at (3 daily + 3 weekly) with their period bounds. Public read (the
-- quests table is), used by the consumer, the replay and the /world panel.
create or replace function public.current_quests(p_at timestamptz default now())
returns table (
  key text, cadence public.quest_cadence, title text, description text, rule jsonb,
  reward_xp integer, reward_credits integer, reward_item_id uuid, sort_order integer,
  period_start date, period_end date
)
language sql stable set search_path = public as $$
  select q.key, q.cadence, q.title, q.description, q.rule, q.reward_xp, q.reward_credits,
         q.reward_item_id, q.sort_order,
         public.quest_period_start(q.cadence, p_at),
         public.quest_period_end(q.cadence, public.quest_period_start(q.cadence, p_at))
  from public.quests q
  where q.active
    and (q.sort_order - 1) / 3 = public.quest_set_index(q.cadence, public.quest_period_start(q.cadence, p_at))
  order by q.cadence, q.sort_order
$$;
grant execute on function public.current_quests(timestamptz) to anon, authenticated;

-- Progress of one rule for one user inside [p_start, p_end): event_count = own events of the
-- type; event_days = distinct UTC days with one. Reads domain_events (admin-only table), so it is
-- a definer function reachable only from the other definer functions here.
create or replace function public.quest_progress_value(p_user uuid, p_rule jsonb, p_start date, p_end date)
returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((
    case when p_rule->>'kind' = 'event_days'
      then (select count(distinct public.mv_utc_day(e.occurred_at)) from public.domain_events e
            where e.actor_id = p_user and e.type = p_rule->>'event'
              and e.occurred_at >= public.mv_utc_day_start(p_start)
              and e.occurred_at <  public.mv_utc_day_start(p_end))
      else (select count(*) from public.domain_events e
            where e.actor_id = p_user and e.type = p_rule->>'event'
              and e.occurred_at >= public.mv_utc_day_start(p_start)
              and e.occurred_at <  public.mv_utc_day_start(p_end))
    end), 0)::integer
$$;
revoke execute on function public.quest_progress_value(uuid, jsonb, date, date) from public, anon, authenticated;

-- When did the user cross the threshold inside the period (the occurred_at of the threshold-th
-- qualifying event / the first event of the threshold-th distinct day)? NULL if not yet.
create or replace function public.quest_completed_at(p_user uuid, p_rule jsonb, p_start date, p_end date)
returns timestamptz
language sql stable security definer set search_path = public as $$
  select case when p_rule->>'kind' = 'event_days'
    then (select d.first_at from (
            select min(e.occurred_at) as first_at
            from public.domain_events e
            where e.actor_id = p_user and e.type = p_rule->>'event'
              and e.occurred_at >= public.mv_utc_day_start(p_start)
              and e.occurred_at <  public.mv_utc_day_start(p_end)
            group by public.mv_utc_day(e.occurred_at)
            order by 1
            offset (p_rule->>'threshold')::integer - 1 limit 1) d)
    else (select e.occurred_at from public.domain_events e
          where e.actor_id = p_user and e.type = p_rule->>'event'
            and e.occurred_at >= public.mv_utc_day_start(p_start)
            and e.occurred_at <  public.mv_utc_day_start(p_end)
          order by e.occurred_at, e.id
          offset (p_rule->>'threshold')::integer - 1 limit 1)
  end
$$;
revoke execute on function public.quest_completed_at(uuid, jsonb, date, date) from public, anon, authenticated;

-- ---------- world_login_streak: consecutive UTC days with a `user.opened` ending on p_day ----------
-- Own streak for the signed-in user (the /world streak chip); any user for admin / backend / the
-- consumer. Capped at 3650 so a runaway loop is impossible.
create or replace function public.world_login_streak(p_user uuid, p_day date default public.mv_utc_day(now()))
returns integer
language plpgsql stable security definer set search_path = public as $$
declare
  v_streak integer := 0;
  v_day    date := p_day;
begin
  if p_user is distinct from auth.uid() and not public.is_admin() and not public.mv_is_backend_caller()
     and current_setting('mv.earn_rpc', true) is distinct from 'on' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  loop
    exit when not exists (
      select 1 from public.domain_events e
      where e.actor_id = p_user and e.type = 'user.opened'
        and e.occurred_at >= public.mv_utc_day_start(v_day)
        and e.occurred_at <  public.mv_utc_day_start(v_day + 1)
    );
    v_streak := v_streak + 1;
    v_day := v_day - 1;
    exit when v_streak >= 3650;
  end loop;
  return v_streak;
end; $$;
grant execute on function public.world_login_streak(uuid, date) to authenticated, service_role;

-- ---------- quest completion side effects (shared by the consumer) ----------
-- Earn (ceiling + key inside earn_tokens), season points, an earned-only item if the quest grants
-- one, quest.completed. Called with mv.earn_rpc already on.
create or replace function public.world_quest_complete(
  p_user uuid, p_key text, p_cadence public.quest_cadence, p_period_start date,
  p_reward_xp integer, p_reward_credits integer, p_reward_item_id uuid, p_at timestamptz
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_season uuid;
  v_ledger public.token_ledger;
  v_inv    public.world_inventory;
begin
  if p_reward_credits > 0 then
    v_ledger := public.earn_tokens(p_user, 'earn_quest', p_reward_credits,
      'quest:' || p_key || ':' || p_user::text || ':' || p_period_start::text);
  end if;

  select id into v_season from public.seasons
    where p_at >= starts_at and p_at < ends_at order by starts_at desc limit 1;
  if v_season is not null and p_reward_xp > 0 then
    insert into public.season_points (season_id, user_id, points) values (v_season, p_user, p_reward_xp)
      on conflict (season_id, user_id) do update
        set points = public.season_points.points + excluded.points, updated_at = now();
  end if;

  if p_reward_item_id is not null and not exists (
    select 1 from public.world_inventory where user_id = p_user and item_id = p_reward_item_id and durable
  ) then
    insert into public.world_inventory (user_id, item_id, acquired_via, ledger_id, durable)
      values (p_user, p_reward_item_id, 'earn', v_ledger.id, true)
      returning * into v_inv;
    perform public.emit_event(p_user, 'world.item_granted', 'world_item', p_reward_item_id,
      jsonb_build_object('inventory_id', v_inv.id, 'quest_key', p_key));
  end if;

  perform public.emit_event(p_user, 'quest.completed', 'quest', null, jsonb_build_object(
    'quest_key', p_key, 'cadence', p_cadence, 'period_start', p_period_start,
    'reward_credits', p_reward_credits, 'reward_xp', p_reward_xp,
    'credited', coalesce(v_ledger.delta, 0), 'season_id', v_season
  ));
end; $$;
revoke execute on function public.world_quest_complete(uuid, text, public.quest_cadence, date, integer, integer, uuid, timestamptz)
  from public, anon, authenticated;

-- ---------- world_earn_consumer: the domain_events consumer (07 §6.2 "trigger for cheap rules") ----------
-- AFTER INSERT on domain_events (row triggers on a partitioned table propagate to every partition).
-- Handles the whitelisted actor-initiated events only; its own emissions (quest.*, tokens.earned,
-- world.item_granted) re-enter and fall through at the first check. Gated per actor by
-- `world_earn` (OFF = nothing is written: no progress, no credits — dark means dark). Progress is
-- RECOUNTED from the event log on every matching event (never incremented), so a replay produces
-- identical rows. Any failure is caught and logged — an earn hiccup must never fail the visit /
-- kudos / add-car that caused it.
create or replace function public.world_earn_consumer()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid := new.actor_id;
  v_day    date;
  v_streak integer;
  v_target integer;
  v_value  integer;
  v_row    public.quest_progress;
  q record;
begin
  if v_user is null or new.type not in (
    'user.opened', 'world.visited', 'world.kudos_given', 'world.guestbook_posted',
    'world.layout_saved', 'world.garage_updated', 'item.created'
  ) then
    return new;
  end if;
  if not public.mv_flag_active('world_earn', v_user) then return new; end if;

  begin
    perform set_config('mv.earn_rpc', 'on', true);

    -- daily first open +1, +5 when the streak reaches a multiple of 7 (07 §3.2); keys per UTC day
    if new.type = 'user.opened' then
      v_day := public.mv_utc_day(new.occurred_at);
      perform public.earn_tokens(v_user, 'earn_daily', 1, 'daily:' || v_user::text || ':' || v_day::text);
      v_streak := public.world_login_streak(v_user, v_day);
      if v_streak > 0 and v_streak % 7 = 0 then
        perform public.earn_tokens(v_user, 'earn_daily', 5, 'streak7:' || v_user::text || ':' || v_day::text);
      end if;
    end if;

    -- quests of the period this event falls in whose rule counts this event type
    for q in select * from public.current_quests(new.occurred_at) where rule->>'event' = new.type loop
      v_target := (q.rule->>'threshold')::integer;
      v_value  := least(public.quest_progress_value(v_user, q.rule, q.period_start, q.period_end), v_target);

      select * into v_row from public.quest_progress
        where user_id = v_user and quest_key = q.key and period_start = q.period_start for update;
      if not found then
        insert into public.quest_progress (user_id, quest_key, period_start, progress)
          values (v_user, q.key, q.period_start, v_value) returning * into v_row;
      elsif v_row.progress <> v_value then
        update public.quest_progress set progress = v_value, updated_at = now()
          where user_id = v_user and quest_key = q.key and period_start = q.period_start
          returning * into v_row;
      else
        continue; -- nothing changed (e.g. a replayed event): no event, no earn
      end if;

      if v_value >= v_target and v_row.completed_at is null then
        update public.quest_progress set completed_at = new.occurred_at, updated_at = now()
          where user_id = v_user and quest_key = q.key and period_start = q.period_start;
        perform public.world_quest_complete(v_user, q.key, q.cadence, q.period_start,
          q.reward_xp, q.reward_credits, q.reward_item_id, new.occurred_at);
      elsif v_value < v_target then
        perform public.emit_event(v_user, 'quest.progressed', 'quest', null, jsonb_build_object(
          'quest_key', q.key, 'period_start', q.period_start, 'progress', v_value, 'threshold', v_target));
      end if;
    end loop;

    perform set_config('mv.earn_rpc', 'off', true);
  exception when others then
    perform set_config('mv.earn_rpc', 'off', true);
    raise warning 'world_earn_consumer(% %): % %', new.type, new.id, sqlstate, sqlerrm;
  end;
  return new;
end; $$;
revoke execute on function public.world_earn_consumer() from public, anon, authenticated;

create trigger world_earn_consumer
  after insert on public.domain_events
  for each row execute function public.world_earn_consumer();

-- ---------- replay_quest_progress: the backstop (F-26 AC "same values after drop + replay") ----------
-- Rebuilds one user's quest_progress rows (and their season points) from domain_events for every
-- period from p_from (default: the user's first event) to today, using the same rotation / count
-- / completion functions the consumer uses. No credits move (the ledger is the truth and
-- earn_tokens is idempotent anyway) and no events are emitted. Admin / service role only.
create or replace function public.replay_quest_progress(p_user uuid, p_from date default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_from   date := p_from;
  v_today  date := public.mv_utc_day(now());
  v_period date;
  v_value  integer;
  v_target integer;
  v_done   timestamptz;
  v_count  integer := 0;
  q record;
begin
  if not public.is_admin() and not public.mv_is_backend_caller() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_from is null then
    select public.mv_utc_day(min(occurred_at)) into v_from from public.domain_events where actor_id = p_user;
  end if;
  if v_from is null then return 0; end if;
  -- start on the Monday of p_from's week so the weekly rows that overlap it are rebuilt whole
  v_from := public.quest_period_start('weekly', public.mv_utc_day_start(least(v_from, v_today)));

  delete from public.quest_progress where user_id = p_user and period_start >= v_from;

  -- daily periods
  for v_period in select d::date from generate_series(v_from, v_today, interval '1 day') d loop
    for q in select * from public.current_quests(public.mv_utc_day_start(v_period)) where cadence = 'daily' loop
      v_target := (q.rule->>'threshold')::integer;
      v_value  := least(public.quest_progress_value(p_user, q.rule, q.period_start, q.period_end), v_target);
      if v_value > 0 then
        v_done := case when v_value >= v_target
          then public.quest_completed_at(p_user, q.rule, q.period_start, q.period_end) end;
        insert into public.quest_progress (user_id, quest_key, period_start, progress, completed_at)
          values (p_user, q.key, q.period_start, v_value, v_done);
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;

  -- weekly periods (Mondays)
  for v_period in select d::date from generate_series(v_from, v_today, interval '7 days') d loop
    for q in select * from public.current_quests(public.mv_utc_day_start(v_period)) where cadence = 'weekly' loop
      v_target := (q.rule->>'threshold')::integer;
      v_value  := least(public.quest_progress_value(p_user, q.rule, q.period_start, q.period_end), v_target);
      if v_value > 0 then
        v_done := case when v_value >= v_target
          then public.quest_completed_at(p_user, q.rule, q.period_start, q.period_end) end;
        insert into public.quest_progress (user_id, quest_key, period_start, progress, completed_at)
          values (p_user, q.key, q.period_start, v_value, v_done);
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;

  -- season points = Σ reward_xp of quests completed inside each season window
  delete from public.season_points where user_id = p_user;
  insert into public.season_points (season_id, user_id, points)
    select s.id, p_user, sum(qu.reward_xp)
    from public.quest_progress qp
    join public.quests qu on qu.key = qp.quest_key
    join public.seasons s on qp.completed_at >= s.starts_at and qp.completed_at < s.ends_at
    where qp.user_id = p_user and qp.completed_at is not null
    group by s.id
    having sum(qu.reward_xp) > 0;

  return v_count;
end; $$;
revoke execute on function public.replay_quest_progress(uuid, date) from public, anon, authenticated;
grant execute on function public.replay_quest_progress(uuid, date) to authenticated, service_role; -- admin check inside

-- ---------- backfill: FIFO state for ledgers that predate this file ----------
-- Chronological replay per user: a credit's `remaining` is what the balance could still spend of
-- it; each debit consumes with the same preference the live functions use (spends earned-first,
-- refunds / adjustments non-expiring-first) and gets its `consumed_earned` + `source`.
do $$
declare
  r record;
  v_consumed integer;
begin
  for r in select * from public.token_ledger where remaining is null and consumed_earned is null
           order by user_id, created_at, id
  loop
    if r.delta > 0 then
      update public.token_ledger set remaining = greatest(0, least(r.delta, r.balance_after)) where id = r.id;
    else
      v_consumed := public.token_consume_fifo(r.user_id, -r.delta, r.reason::text like 'spend\_%');
      update public.token_ledger
        set consumed_earned = v_consumed,
            source = case
              when source is not null then source
              when v_consumed >= -r.delta then 'earned'::public.token_ledger_source
              when v_consumed = 0 then 'purchased'::public.token_ledger_source
              else 'mixed'::public.token_ledger_source
            end
        where id = r.id;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
