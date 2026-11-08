-- 0014c_world_season_economy — MV-W05-01…06 (DB half), F-26/F-27/F-28, 07 §2.1 (garage score),
-- §2.5 (seasons), §2.6 (shop: tunes, consumables, Spotlight), §3.3 (earn freeze), §3.4 (weekly
-- economy metrics), D-070 / D-071 / D-077 / D-089, 03 §2.26–§2.27 / §2.38 / §2.41, D-091.
--
-- Shipped DARK (D-028): nothing here renders until `world` + `world_shop` are on, and nothing earns
-- until `world_earn` is on (the flip itself is Sreejith's, MV-W05-08). Additive only (D-006): new
-- nullable/defaulted columns, one new table, replaced function bodies (same signatures), new
-- functions, one view re-created with an extra trailing column, PLACEHOLDER data rows (07 §3.3
-- "pricing is data" — same status as D-064 / D-070 / D-086: change by data migration, never code).
-- No new enum values, so one file suffices (no cross-transaction enum reference, cf. 0012 → 0013).
--
-- Server authority (07 P4, D-071): the garage `score` only changes inside world_recompute_score()
-- (guard trigger + `mv.world_rpc` GUC); season milestones pay through earn_tokens() (ceiling +
-- key inside); Spotlight is a priced consumable through spend_tokens; the earn freeze is an admin
-- RPC that earn_tokens() consults — never a client assertion.

-- =====================================================================================
-- 1. Inventory expiry (consumables, Spotlight 24 h — a W01 PROGRESS-WORLD open point)
-- =====================================================================================
alter table public.world_inventory
  add column if not exists expires_at timestamptz;
create index if not exists world_inventory_active_consumable_idx
  on public.world_inventory (user_id, item_id, expires_at) where expires_at is not null;

-- =====================================================================================
-- 2. Seasons: free track milestones + lifecycle stamps (07 §2.5, §3.2 "+5 … +25 per season")
-- =====================================================================================
-- `track` = ordered milestones [{"points": n, "reward_credits": n, "label": text,
-- "reward_item_sku": sku | absent}]; paid through earn_tokens with key
-- 'season:<season>:<index>:<user>' so a replay never pays twice. The last milestone with a
-- reward_item_sku grants that earned-only item and emits `season.finished` (the World badge).
-- `announced_at` / `closed_at` are the rollover job's idempotency stamps (season.started /
-- season.ended are emitted exactly once each).
alter table public.seasons
  add column if not exists track        jsonb not null default '[]'::jsonb,
  add column if not exists announced_at timestamptz,
  add column if not exists closed_at    timestamptz,
  add constraint seasons_track_is_array check (jsonb_typeof(track) = 'array');

-- Leaderboard-ready (W11 adds the public view; the index is cheap now).
create index if not exists season_points_leaderboard_idx
  on public.season_points (season_id, points desc, updated_at);

-- =====================================================================================
-- 3. PLACEHOLDER launch catalogue (D-086: no design pack — art stays token mixes; rows are data)
-- =====================================================================================
-- Kinds: decor / theme / signage / consumable (Spotlight) / tune (racing arrives with W08–W09;
-- sold now so the economy has its sink, effect capped server-side later per D-075) / trophy
-- (earned-only: price NULL). Season-limited rows carry season_id (buyable only while it runs).
insert into public.world_items (sku, kind, name, description, price, min_level, season_id, active, effect, sort_order) values
  ('theme_neon_workshop',   'theme',      'Neon Workshop',     'A dark workshop with neon trim.',                          25, 1, null, true, '{}', 10),
  ('theme_showroom_white',  'theme',      'Showroom White',    'Bright, clean, dealership white.',                          25, 3, null, true, '{}', 11),
  ('decor_neon_sign',       'decor',      'Neon sign',         'A glowing sign for the back wall.',                         10, 1, null, true, '{"slot": "wall"}', 20),
  ('decor_tool_wall',       'decor',      'Tool wall',         'Pegboard, spanners, the works.',                            15, 1, null, true, '{"slot": "wall"}', 21),
  ('decor_tyre_stack',      'decor',      'Tyre stack',        'A stack of slicks in the corner.',                           5, 1, null, true, '{"slot": "floor"}', 22),
  ('decor_trophy_shelf',    'decor',      'Trophy shelf',      'Somewhere to put the silverware.',                          30, 2, null, true, '{"slot": "wall"}', 23),
  ('decor_founders_banner', 'decor',      'Founders banner',   'Only sold during the Founders'' Season.',                   15, 1, '00000000-0000-4000-8000-00000000f001', true, '{"slot": "wall"}', 24),
  ('signage_welcome',       'signage',    'Welcome board',     'A free sign for your door.',                                 0, 1, null, true, '{"slot": "door"}', 30),
  ('tune_street',           'tune',       'Street tune',       'A small boost to acceleration in races (racing arrives later).', 30, 2, null, true, '{"stat": "accel", "pct": 2}', 50),
  ('tune_track',            'tune',       'Track tune',        'A small boost to top speed in races (racing arrives later).',    30, 2, null, true, '{"stat": "top_speed", "pct": 2}', 51),
  ('trophy_season_finisher','trophy',     'Season finisher',   'Earned by finishing a season track.',                     null, 1, null, true, '{}', 60),
  ('spotlight_24h',         'consumable', 'Spotlight (24 h)',  'Your garage at the top of Open garages for 24 hours. Labelled Spotlight.', 20, 1, null, true, '{"grants": "spotlight", "hours": 24}', 1002)
on conflict (sku) do nothing;

-- The founders season's track (PLACEHOLDER numbers, 07 §3.2).
update public.seasons set track = '[
  {"points": 50,  "reward_credits": 5,  "label": "Warm-up"},
  {"points": 150, "reward_credits": 10, "label": "On the road"},
  {"points": 300, "reward_credits": 25, "label": "Season finisher", "reward_item_sku": "trophy_season_finisher"}
]'::jsonb
where id = '00000000-0000-4000-8000-00000000f001' and track = '[]'::jsonb;

-- =====================================================================================
-- 4. buy_world_item: + Spotlight (expiring consumable), season-limited gate (replaces 0013a's body)
-- =====================================================================================
-- Everything 0013a did, plus: an item with season_id is buyable only while that season runs
-- (`season_closed`); `effect.grants = spotlight` posts `spend_spotlight` (07 §3.1), sets
-- `expires_at = now() + effect.hours`, and refuses while one is still active (`spotlight_active`)
-- — so a retried request cannot stack two charges either. The event carries `expires_at`.
create or replace function public.buy_world_item(p_item_id uuid, p_key text default null)
returns public.world_inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_garage  public.world_garages;
  v_item    public.world_items;
  v_grants  text;
  v_cap     integer;
  v_durable boolean;
  v_key     text;
  v_reason  public.token_ledger_reason := 'spend_world_item';
  v_expires timestamptz;
  v_grant   public.entitlement_grants;
  v_inv     public.world_inventory;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  perform public.ensure_world_garage();
  select * into v_garage from public.world_garages where user_id = v_uid for update;

  select * into v_item from public.world_items where id = p_item_id and active;
  if not found then raise exception 'item_not_found' using errcode = 'P0002'; end if;
  if v_item.price is null then raise exception 'earned_only' using errcode = 'P0001'; end if;
  if v_garage.level < v_item.min_level then raise exception 'level_too_low' using errcode = 'P0001'; end if;
  if v_item.season_id is not null and not exists (
    select 1 from public.seasons s where s.id = v_item.season_id and now() >= s.starts_at and now() < s.ends_at
  ) then
    raise exception 'season_closed' using errcode = 'P0001';
  end if;

  v_grants := v_item.effect ->> 'grants';
  if v_grants = 'rename' then raise exception 'item_not_found' using errcode = 'P0002'; end if; -- rename_world_garage only
  if v_grants = 'display_slot' then
    select max_extra_slots into v_cap from public.world_levels where level = v_garage.level;
    if v_garage.extra_slots >= coalesce(v_cap, 0) then
      raise exception 'slot_cap_reached' using errcode = 'P0001';
    end if;
  end if;
  if v_grants = 'spotlight' then
    if exists (
      select 1 from public.world_inventory i join public.world_items w on w.id = i.item_id
      where i.user_id = v_uid and w.effect ->> 'grants' = 'spotlight' and i.expires_at > now()
    ) then
      raise exception 'spotlight_active' using errcode = 'P0001';
    end if;
    v_reason  := 'spend_spotlight';
    v_expires := now() + make_interval(hours => greatest(1, coalesce((v_item.effect ->> 'hours')::integer, 24)));
  end if;

  v_durable := v_item.kind <> 'consumable';
  if v_durable and exists (
    select 1 from public.world_inventory where user_id = v_uid and item_id = p_item_id and durable
  ) then
    raise exception 'already_owned' using errcode = 'P0001';
  end if;

  v_key := coalesce(p_key, case when v_durable then 'world_item:' || v_uid::text || ':' || p_item_id::text end);
  if v_item.price > 0 then
    v_grant := public.spend_tokens(
      v_reason, v_item.price, 'world_item', 1, v_expires, 'world_item', p_item_id, v_key
    );
  end if;

  insert into public.world_inventory (user_id, item_id, acquired_via, ledger_id, durable, expires_at)
    values (v_uid, p_item_id, 'purchase', v_grant.ledger_id, v_durable, v_expires)
    returning * into v_inv;

  if v_grants = 'display_slot' then
    perform set_config('mv.world_rpc', 'on', true);
    update public.world_garages set extra_slots = extra_slots + 1 where user_id = v_uid;
    perform set_config('mv.world_rpc', 'off', true);
  end if;

  perform public.emit_event(v_uid, 'world.item_bought', 'world_item', p_item_id, jsonb_build_object(
    'sku', v_item.sku, 'kind', v_item.kind, 'price', v_item.price, 'grants', v_grants,
    'inventory_id', v_inv.id, 'ledger_id', v_grant.ledger_id, 'expires_at', v_expires,
    'season_id', v_item.season_id
  ));
  return v_inv;
end; $$;

-- ---------- world_open_garages: + spotlight_until (trailing column; CREATE OR REPLACE keeps the rest) ----------
create or replace view public.world_open_garages as
  select g.user_id, g.name, g.level, g.score, g.featured_item_id, g.visit_count, g.kudos_count,
         g.updated_at, p.handle, p.display_name, p.country_code, p.city,
         (select max(i.expires_at) from public.world_inventory i
            join public.world_items w on w.id = i.item_id
           where i.user_id = g.user_id and w.effect ->> 'grants' = 'spotlight' and i.expires_at > now()) as spotlight_until
  from public.world_garages g
  join public.public_profiles p on p.id = g.user_id
  where g.open_mode = 'public' and not public.is_blocked(auth.uid(), g.user_id);

-- =====================================================================================
-- 5. Garage score (07 §2.1): a pure function of garage state + social rows, consumer-maintained
-- =====================================================================================
-- score = Σ displayed cars × 10 + Σ rarity weight × 5 + decor × 5 + trophies × 15 + kudos × 2
--       + visits × 1 + (level − 1) × 20.   PLACEHOLDER weights (D-091) — mirrored in
-- src/domain/world/score.ts (SCORE_WEIGHTS); change both or neither. Displayed = layout slots that
-- hold a public, non-deleted car of the owner; rarity weights: common 0 / uncommon 1 / rare 2 /
-- super-rare 3 / treasure-hunt 5 / chase 5. Kudos / visits are the durable one-per-day rows the
-- W03 RPCs write atomically with their `world.kudos_given` / `world.visited` events, so a replay
-- of either source yields the same number (pgTAP 0027 pins it).
create or replace function public.world_garage_score_value(p_user uuid)
returns integer
language sql stable security definer set search_path = public as $$
  with g as (select * from public.world_garages where user_id = p_user),
  shown as (
    select ci.rarity
    from g, jsonb_array_elements(coalesce(g.layout -> 'slots', '[]'::jsonb)) s
    join public.collection_items ci on ci.id::text = s ->> 'itemId'
    where ci.owner_id = p_user and ci.is_public and ci.deleted_at is null
  )
  select coalesce((
    select (select count(*) from shown) * 10
         + (select coalesce(sum(case rarity
              when 'uncommon' then 1 when 'rare' then 2 when 'super-rare' then 3
              when 'treasure-hunt' then 5 when 'chase' then 5 else 0 end), 0) from shown) * 5
         + jsonb_array_length(coalesce(g.layout -> 'decor', '[]'::jsonb)) * 5
         + (select count(*) from public.world_inventory i join public.world_items w on w.id = i.item_id
             where i.user_id = p_user and w.kind = 'trophy') * 15
         + (select count(*) from public.world_kudos k where k.garage_user_id = p_user) * 2
         + (select count(*) from public.world_visits v where v.garage_user_id = p_user) * 1
         + (g.level - 1) * 20
    from g
  ), 0)::integer
$$;
revoke execute on function public.world_garage_score_value(uuid) from public, anon, authenticated;

-- Writes the recomputed score through the guard (GUC), emits world.score_updated when it moved.
-- Returns the score (or NULL when the user has no garage). Admin / backend / the consumer only.
create or replace function public.world_recompute_score(p_user uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_old integer;
  v_new integer;
begin
  if not public.is_admin() and not public.mv_is_backend_caller()
     and current_setting('mv.world_score', true) is distinct from 'on' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select score into v_old from public.world_garages where user_id = p_user for update;
  if not found then return null; end if;
  v_new := public.world_garage_score_value(p_user);
  if v_new <> v_old then
    perform set_config('mv.world_rpc', 'on', true);
    update public.world_garages set score = v_new where user_id = p_user;
    perform set_config('mv.world_rpc', 'off', true);
    perform public.emit_event(p_user, 'world.score_updated', 'garage', p_user,
      jsonb_build_object('from', v_old, 'to', v_new));
  end if;
  return v_new;
end; $$;
revoke execute on function public.world_recompute_score(uuid) from public, anon, authenticated;
grant execute on function public.world_recompute_score(uuid) to authenticated, service_role; -- admin check inside

-- The nightly recompute (07 §6.4; schedule = the jobs runner, MV-W04-04). Returns garages changed.
create or replace function public.world_recompute_all_scores()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_changed integer := 0;
begin
  if not public.is_admin() and not public.mv_is_backend_caller() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  for r in select user_id, score from public.world_garages order by user_id loop
    if public.world_recompute_score(r.user_id) is distinct from r.score then v_changed := v_changed + 1; end if;
  end loop;
  return v_changed;
end; $$;
revoke execute on function public.world_recompute_all_scores() from public, anon, authenticated;
grant execute on function public.world_recompute_all_scores() to authenticated, service_role;

-- The consumer: AFTER INSERT on domain_events, recomputes the affected garage. Not flag-gated —
-- a garage row only exists once `world` was on for its owner, and recomputing a stale score is
-- harmless while dark. Its own world.score_updated falls through at the first check. Errors are
-- caught + logged like world_earn_consumer: a score hiccup must never fail a visit or a save.
create or replace function public.world_score_consumer()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_garage uuid;
begin
  v_garage := case
    when new.type in ('world.visited', 'world.kudos_given') then new.entity_id            -- entity = the garage
    when new.type in ('world.layout_saved', 'world.garage_updated', 'world.level_up') then new.entity_id
    when new.type in ('world.item_bought', 'world.item_granted', 'item.made_private', 'item.deleted',
                      'item.made_public', 'item.restored') then new.actor_id
    else null
  end;
  if v_garage is null then return new; end if;
  begin
    perform set_config('mv.world_score', 'on', true);
    perform public.world_recompute_score(v_garage);
    perform set_config('mv.world_score', 'off', true);
  exception when others then
    perform set_config('mv.world_score', 'off', true);
    raise warning 'world_score_consumer(% %): % %', new.type, new.id, sqlstate, sqlerrm;
  end;
  return new;
end; $$;
revoke execute on function public.world_score_consumer() from public, anon, authenticated;
drop trigger if exists world_score_consumer on public.domain_events;
create trigger world_score_consumer
  after insert on public.domain_events
  for each row execute function public.world_score_consumer();

-- =====================================================================================
-- 6. Earn freeze per user (07 §3.3, F-26 "admin earn freeze", 06 §5 runbook "earn exploit")
-- =====================================================================================
create table public.world_earn_freezes (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  frozen_by  uuid references public.profiles(id) on delete set null,
  note       text check (note is null or char_length(note) <= 280),
  created_at timestamptz not null default now()
);
alter table public.world_earn_freezes enable row level security;
create policy "Admins read earn freezes" on public.world_earn_freezes for select
  using (public.is_admin());
grant select on public.world_earn_freezes to authenticated;
-- No write policies: admin_set_earn_freeze() only.

-- Freeze / unfreeze, logged as user.earn_frozen / user.earn_unfrozen (the "tokens.adjusted-style"
-- audit row 08 asks for, with the admin as actor). Returns the new frozen state.
create or replace function public.admin_set_earn_freeze(p_user uuid, p_frozen boolean, p_note text default null)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if p_frozen then
    insert into public.world_earn_freezes (user_id, frozen_by, note) values (p_user, v_uid, p_note)
      on conflict (user_id) do update set frozen_by = excluded.frozen_by, note = excluded.note;
    perform public.emit_event(v_uid, 'user.earn_frozen', 'profile', p_user, jsonb_build_object('note', p_note));
  else
    delete from public.world_earn_freezes where user_id = p_user;
    if found then
      perform public.emit_event(v_uid, 'user.earn_unfrozen', 'profile', p_user, jsonb_build_object('note', p_note));
    end if;
  end if;
  return p_frozen;
end; $$;
grant execute on function public.admin_set_earn_freeze(uuid, boolean, text) to authenticated;

-- ---------- earn_tokens: 0014b's body + the freeze check (same signature, same grants) ----------
-- A frozen user earns nothing (NULL, nothing written) — quests still track, season points still
-- accrue (they are not credits), only the credit is withheld. The global freeze stays the
-- `world_earn` flag audience (D-077).
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

  if exists (select 1 from public.world_earn_freezes where user_id = p_user) then return null; end if;

  perform 1 from public.profiles where id = p_user for update;
  if not found then raise exception 'user_not_found' using errcode = 'P0002'; end if;

  select coalesce(sum(delta), 0) into v_today from public.token_ledger
    where user_id = p_user and delta > 0 and reason::text like 'earn\_%'
      and created_at >= public.mv_utc_day_start(public.mv_utc_day(now()));
  v_amount := least(p_amount, c_ceiling - v_today);
  if v_amount <= 0 then return null; end if;

  return public.credit_tokens(p_user, v_amount, p_reason, 'earn', null, p_key);
end; $$;

-- =====================================================================================
-- 7. Season track: milestone payouts + the rollover job
-- =====================================================================================
-- Pays every milestone the user's points have reached and not yet been paid for (key per
-- season × index × user). A clipped / frozen earn leaves no row, so the next call retries it.
-- The last milestone that names a reward_item_sku grants it (earned-only, idempotent) and emits
-- season.finished once (the World badge + trophy). Called with mv.earn_rpc already on.
create or replace function public.season_track_award(p_user uuid, p_season uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_points integer;
  v_track  jsonb;
  m        jsonb;
  v_idx    integer := 0;
  v_key    text;
  v_ledger public.token_ledger;
  v_item   public.world_items;
  v_inv    public.world_inventory;
  v_paid   integer := 0;
begin
  select points into v_points from public.season_points where season_id = p_season and user_id = p_user;
  select track into v_track from public.seasons where id = p_season;
  if v_points is null or v_track is null then return 0; end if;

  for m in select * from jsonb_array_elements(v_track) loop
    v_idx := v_idx + 1;
    v_ledger := null;
    continue when v_points < coalesce((m ->> 'points')::integer, 2147483647);
    v_key := 'season:' || p_season::text || ':' || v_idx::text || ':' || p_user::text;
    continue when exists (select 1 from public.token_ledger where idempotency_key = v_key);

    if coalesce((m ->> 'reward_credits')::integer, 0) > 0 then
      v_ledger := public.earn_tokens(p_user, 'earn_season', (m ->> 'reward_credits')::integer, v_key);
      continue when v_ledger.id is null; -- frozen or no headroom today: retried on the next award
    end if;
    v_paid := v_paid + 1;
    perform public.emit_event(p_user, 'season.milestone_reached', 'season', p_season, jsonb_build_object(
      'index', v_idx, 'points', m ->> 'points', 'label', m ->> 'label',
      'credited', coalesce(v_ledger.delta, 0), 'ledger_id', v_ledger.id));

    if m ? 'reward_item_sku' then
      select * into v_item from public.world_items where sku = m ->> 'reward_item_sku';
      if found and not exists (
        select 1 from public.world_inventory where user_id = p_user and item_id = v_item.id and durable
      ) then
        insert into public.world_inventory (user_id, item_id, acquired_via, ledger_id, durable)
          values (p_user, v_item.id, 'earn', v_ledger.id, true) returning * into v_inv;
        perform public.emit_event(p_user, 'world.item_granted', 'world_item', v_item.id,
          jsonb_build_object('inventory_id', v_inv.id, 'season_id', p_season, 'milestone', v_idx));
      end if;
      perform public.emit_event(p_user, 'season.finished', 'season', p_season,
        jsonb_build_object('points', v_points, 'milestone', v_idx));
    end if;
  end loop;
  return v_paid;
end; $$;
revoke execute on function public.season_track_award(uuid, uuid) from public, anon, authenticated;

-- ---------- world_quest_complete: 0014b's body + the track award after the points upsert ----------
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
    perform public.season_track_award(p_user, v_season);
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

-- ---------- rollover_season: the jobs call (07 §6.4 "season rollover"; schedule = MV-W04-04) ----------
-- Idempotent and deterministic: announces every season that has started and was not announced
-- (season.started, stamps announced_at), closes every season that has ended and was not closed
-- (season.ended with participants + top points, stamps closed_at — points of a closed season are
-- frozen by construction: the consumer only credits the running window). "Reset" = the next
-- season has its own rows. Awards are already paid incrementally (season_track_award), so the
-- close pays nothing more. A second run returns {started: 0, ended: 0}.
create or replace function public.rollover_season(p_at timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s record;
  v_started integer := 0;
  v_ended   integer := 0;
  v_participants integer;
  v_top integer;
begin
  if not public.is_admin() and not public.mv_is_backend_caller() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  for s in select * from public.seasons where starts_at <= p_at and announced_at is null order by starts_at, id loop
    update public.seasons set announced_at = p_at where id = s.id;
    perform public.emit_event(null, 'season.started', 'season', s.id,
      jsonb_build_object('name', s.name, 'theme', s.theme, 'starts_at', s.starts_at, 'ends_at', s.ends_at));
    v_started := v_started + 1;
  end loop;
  for s in select * from public.seasons where ends_at <= p_at and closed_at is null order by ends_at, id loop
    select count(*), coalesce(max(points), 0) into v_participants, v_top
      from public.season_points where season_id = s.id;
    update public.seasons set closed_at = p_at where id = s.id;
    perform public.emit_event(null, 'season.ended', 'season', s.id,
      jsonb_build_object('name', s.name, 'participants', v_participants, 'top_points', v_top));
    v_ended := v_ended + 1;
  end loop;
  return jsonb_build_object('started', v_started, 'ended', v_ended);
end; $$;
revoke execute on function public.rollover_season(timestamptz) from public, anon, authenticated;
grant execute on function public.rollover_season(timestamptz) to authenticated, service_role; -- admin check inside

-- =====================================================================================
-- 8. Economy dashboard (07 §3.4, F-28 AC: "SQL over the ledger source/reason columns")
-- =====================================================================================
-- Weekly rows (UTC Monday weeks, newest first). sources = earned credits; sinks = every spend_*
-- debit; sinks ÷ sources, earned-vs-purchased share and breakage are derived in the page from
-- these integers (no second balance anywhere). Admin / backend only.
create or replace function public.world_economy_weekly(p_weeks integer default 8)
returns table (
  week_start date, earned integer, purchased integer, spent integer, spent_from_earned integer,
  world_spent integer, expired integer, refunded integer, earners integer, spenders integer, buyers integer
)
language sql stable security definer set search_path = public as $$
  with w as (
    select (date_trunc('week', now() at time zone 'utc') - make_interval(weeks => n))::date as week_start
    from generate_series(0, greatest(1, least(coalesce(p_weeks, 8), 52)) - 1) n
  )
  select w.week_start,
    coalesce(sum(case when l.delta > 0 and l.reason::text like 'earn\_%' then l.delta end), 0)::integer,
    coalesce(sum(case when l.reason = 'purchase' then l.delta end), 0)::integer,
    coalesce(sum(case when l.reason::text like 'spend\_%' then -l.delta end), 0)::integer,
    coalesce(sum(case when l.reason::text like 'spend\_%' then l.consumed_earned end), 0)::integer,
    coalesce(sum(case when l.reason in ('spend_garage_level','spend_world_item','spend_meetup_host',
                                        'spend_race_entry','spend_spotlight','spend_rename') then -l.delta end), 0)::integer,
    coalesce(sum(case when l.reason = 'expire_earned' then -l.delta end), 0)::integer,
    coalesce(sum(case when l.reason = 'refund' then -l.delta end), 0)::integer,
    count(distinct case when l.delta > 0 and l.reason::text like 'earn\_%' then l.user_id end)::integer,
    count(distinct case when l.reason::text like 'spend\_%' then l.user_id end)::integer,
    count(distinct case when l.reason = 'purchase' then l.user_id end)::integer
  from w
  left join public.token_ledger l
    on l.created_at >= public.mv_utc_day_start(w.week_start)
   and l.created_at <  public.mv_utc_day_start(w.week_start + 7)
  where public.is_admin() or public.mv_is_backend_caller()
  group by w.week_start
  order by w.week_start desc
$$;
revoke execute on function public.world_economy_weekly(integer) from public, anon;
grant execute on function public.world_economy_weekly(integer) to authenticated, service_role;

-- Point-in-time figures: one row per metric (renders as a plain table, D-027). Balances are over
-- World-active users (a world_garages row). earn-cap hit rate = user-days at the ceiling ÷
-- user-days with any earn, last 7 UTC days. breakage = Σ expire_earned debits, all time.
create or replace function public.world_economy_summary()
returns table (metric text, value numeric, note text)
language sql stable security definer set search_path = public as $$
  with active as (select user_id from public.world_garages),
  bal as (select p.tokens from public.profiles p join active a on a.user_id = p.id),
  earn_days as (
    select user_id, public.mv_utc_day(created_at) as d, sum(delta) as earned
    from public.token_ledger
    where delta > 0 and reason::text like 'earn\_%'
      and created_at >= public.mv_utc_day_start(public.mv_utc_day(now()) - 6)
    group by user_id, public.mv_utc_day(created_at)
  ),
  first_spend as (
    select l.user_id, min(l.created_at) - min(g.created_at) as lag
    from public.token_ledger l join public.world_garages g on g.user_id = l.user_id
    where l.reason in ('spend_garage_level','spend_world_item','spend_meetup_host',
                       'spend_race_entry','spend_spotlight','spend_rename')
    group by l.user_id
  ),
  rows_ as (
    select 'world_active_users'::text as metric, (select count(*) from active)::numeric as value,
           'users with a World garage'::text as note
    union all select 'median_balance', coalesce((select percentile_cont(0.5) within group (order by tokens) from bal), 0)::numeric,
           'tokens, World-active users'
    union all select 'p90_balance', coalesce((select percentile_cont(0.9) within group (order by tokens) from bal), 0)::numeric,
           'hoarding tail'
    union all select 'earned_outstanding', coalesce((select sum(remaining) from public.token_ledger where delta > 0 and source = 'earned'), 0)::numeric,
           'earned credits not yet spent or expired (liability)'
    union all select 'purchased_outstanding', coalesce((select sum(remaining) from public.token_ledger where delta > 0 and source <> 'earned'), 0)::numeric,
           'purchased / promo / adjust credits not yet spent'
    union all select 'earn_user_days_7d', (select count(*) from earn_days)::numeric, 'user-days with any earn, last 7 days'
    union all select 'earn_cap_hits_7d', (select count(*) from earn_days where earned >= 15)::numeric, 'user-days at the daily ceiling (15)'
    union all select 'breakage_total', coalesce((select sum(-delta) from public.token_ledger where reason = 'expire_earned'), 0)::numeric,
           'earned credits expired, all time'
    union all select 'frozen_users', (select count(*) from public.world_earn_freezes)::numeric, 'per-user earn freezes in force'
    union all select 'median_days_to_first_world_spend',
           coalesce((select percentile_cont(0.5) within group (order by extract(epoch from lag) / 86400) from first_spend), 0)::numeric,
           'from garage creation, users who spent in the World'
  )
  select metric, round(value, 2), note from rows_
  where public.is_admin() or public.mv_is_backend_caller()
$$;
revoke execute on function public.world_economy_summary() from public, anon;
grant execute on function public.world_economy_summary() to authenticated, service_role;

-- =====================================================================================
-- 9. World badges (07 §2.5 "extend achievements with World badges"; F-13 consumer evaluates them)
-- =====================================================================================
-- Evaluated by the existing pull-based consumer (D-079) when the owner opens /garage or /profile,
-- on the events gamification_events() returns — extended below. `world_host` stays dormant until
-- W06 emits meetup.ended for the host.
insert into public.achievements (key, name, description, rule, icon, sort_order) values
  ('world_first_visit',     'First Visit',      'Visit another collector''s garage.',
     '{"kind":"event_count","event":"world.visited","threshold":1}', 'world', 6),
  ('world_kudos_10',        'Crowd Favourite',  'Receive kudos 10 times.',
     '{"kind":"event_count","event":"world.kudos_given","threshold":10}', 'world', 7),
  ('world_host',            'Host',             'Host a virtual meetup.',
     '{"kind":"event_count","event":"meetup.ended","threshold":1}', 'world', 8),
  ('world_season_finisher', 'Season Finisher',  'Finish a season track.',
     '{"kind":"event_count","event":"season.finished","threshold":1}', 'world', 9)
on conflict (key) do nothing;

-- gamification_events: 0010's body + the World types; kudos pay the garage owner (entity_id),
-- meetup.ended pays the host (actor), season.finished pays the actor.
create or replace function public.gamification_events(p_user uuid default auth.uid())
returns table (
  id bigint, actor_id uuid, type text, entity text, entity_id uuid, payload jsonb, occurred_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select e.id, e.actor_id, e.type, e.entity, e.entity_id,
         case when e.type = 'offer.completed'
              then e.payload || jsonb_build_object('buyer_id', o.buyer_id, 'seller_id', o.seller_id)
              else e.payload end as payload,
         e.occurred_at
  from public.domain_events e
  left join public.offers o on e.type = 'offer.completed' and o.id = e.entity_id
  where p_user is not null
    and (p_user = auth.uid() or public.is_admin() or public.mv_is_backend_caller())
    and e.type in ('item.created', 'item.photo_added', 'listing.published', 'offer.completed',
                   'review.created', 'user.opened',
                   'world.visited', 'world.kudos_given', 'meetup.ended', 'season.finished')
    and (
      (e.actor_id = p_user and e.type <> 'world.kudos_given')
      or (e.type = 'world.kudos_given' and e.entity_id = p_user)
      or (e.type = 'offer.completed' and (o.buyer_id = p_user or o.seller_id = p_user))
      or (e.type = 'review.created' and e.payload->>'seller_id' = p_user::text)
    )
  order by e.occurred_at, e.id;
$$;

notify pgrst, 'reload schema';
