-- 0012_world_core — MV-W01-03, F-20/F-27, 07-collectors-world.md §3.1/§7, 03-data-model.md §2.24–§2.27.
--
-- Collectors World foundations, shipped DARK (D-028): every `world*` flag is seeded OFF, nothing
-- in the app reads these tables until W02+. Additive only (D-006): new tables, new enum values,
-- new nullable columns. Prices/level stats are PLACEHOLDER data rows (07 §3.2, same status as
-- D-064) — tune later with a data-only migration, never in code (07 §3.3 "pricing is data").
--
-- Server authority (07 P4): garage level and score can only change through the RPCs in
-- 0013_world_rpcs (a guard trigger rejects direct updates); inventory rows are RPC/consumer-only
-- (no insert policy at all); every token movement still goes through spend_tokens (D-021).

-- ---------- enums ----------
create type public.world_open_mode as enum ('public', 'followers', 'invite');
create type public.world_item_kind as enum ('decor', 'theme', 'tune', 'trophy', 'consumable', 'signage');
create type public.world_acquired_via as enum ('purchase', 'earn', 'promo');
create type public.token_ledger_source as enum ('purchased', 'earned', 'promo', 'adjust');

-- 07 §3.1: one ledger, more reasons. Enum additions are additive (D-006). The new values are
-- only *used* from 0013 onwards (a value added inside a transaction can't be referenced in the
-- same transaction — Postgres rule, which is why the RPCs live in the next migration file).
alter type public.token_ledger_reason add value if not exists 'earn_quest';
alter type public.token_ledger_reason add value if not exists 'earn_daily';
alter type public.token_ledger_reason add value if not exists 'earn_race_participation';
alter type public.token_ledger_reason add value if not exists 'earn_host';
alter type public.token_ledger_reason add value if not exists 'earn_attend';
alter type public.token_ledger_reason add value if not exists 'earn_achievement';
alter type public.token_ledger_reason add value if not exists 'earn_referral';
alter type public.token_ledger_reason add value if not exists 'earn_season';
alter type public.token_ledger_reason add value if not exists 'expire_earned';
alter type public.token_ledger_reason add value if not exists 'spend_garage_level';
alter type public.token_ledger_reason add value if not exists 'spend_world_item';
alter type public.token_ledger_reason add value if not exists 'spend_meetup_host';
alter type public.token_ledger_reason add value if not exists 'spend_race_entry';
alter type public.token_ledger_reason add value if not exists 'spend_spotlight';
alter type public.token_ledger_reason add value if not exists 'spend_rename';
-- A World purchase still produces an entitlement_grants row via spend_tokens (the receipt that
-- ties the ledger row to what it bought) — two new grant kinds, nothing else about spend_tokens
-- changes.
alter type public.entitlement_grant_kind add value if not exists 'world_level';
alter type public.entitlement_grant_kind add value if not exists 'world_item';

-- ---------- token_ledger.source (07 §3.1, §10 "accounting") ----------
-- Separates paid from earned value without a second balance. Derived from the reason by a
-- BEFORE INSERT trigger when the writer doesn't set it; spends stay NULL ("not attributed") until
-- W04's FIFO earned-first spend_tokens sets it per row.
alter table public.token_ledger add column if not exists source public.token_ledger_source;

create or replace function public.token_ledger_source_for(p_reason public.token_ledger_reason)
returns public.token_ledger_source language sql immutable as $$
  select case
    when p_reason::text in ('purchase', 'refund') then 'purchased'::public.token_ledger_source
    when p_reason::text like 'earn\_%' or p_reason::text = 'expire_earned' then 'earned'::public.token_ledger_source
    when p_reason::text = 'promo' then 'promo'::public.token_ledger_source
    when p_reason::text = 'admin_adjust' then 'adjust'::public.token_ledger_source
    else null
  end;
$$;

create or replace function public.set_token_ledger_source()
returns trigger language plpgsql as $$
begin
  if new.source is null then new.source := public.token_ledger_source_for(new.reason); end if;
  return new;
end; $$;
create trigger set_token_ledger_source before insert on public.token_ledger
  for each row execute function public.set_token_ledger_source();

update public.token_ledger set source = public.token_ledger_source_for(reason) where source is null;

-- ---------- profiles: 18+ self-declaration + accepted terms version (07 P8, §10) ----------
alter table public.profiles
  add column if not exists age_confirmed_at timestamptz,
  add column if not exists terms_version text;

-- ---------- world_levels (reference, seeded; §2.24) ----------
create table public.world_levels (
  level          integer primary key check (level between 1 and 5),
  name           text not null unique,
  display_slots  integer not null check (display_slots > 0),
  decor_slots    integer not null check (decor_slots >= 0),
  visitor_cap    integer not null check (visitor_cap >= 0),
  host_cap       integer not null check (host_cap >= 0),
  price          integer not null check (price >= 0),
  min_xp_level   integer not null default 0 check (min_xp_level >= 0)
);
alter table public.world_levels enable row level security;
create policy "Anyone reads world levels" on public.world_levels for select using (true);
grant select on public.world_levels to anon, authenticated;
-- No write policies: levels change by migration only (07 §3.3).

-- PLACEHOLDER rows (07 §2.1 names — Varun's call per §14; §3.2 prices; F-13 tier gate so money
-- alone cannot skip progression). Level 1 is the free starting level.
insert into public.world_levels (level, name, display_slots, decor_slots, visitor_cap, host_cap, price, min_xp_level) values
  (1, 'Shed',      4,  2,  10,   0,   0, 0),
  (2, 'Garage',    8,  4,  25,  10,  40, 1),
  (3, 'Showroom', 12,  6,  50,  25,  90, 2),
  (4, 'Warehouse',20,  8, 100,  50, 180, 3),
  (5, 'Vault',    30, 12, 200, 100, 350, 4);

-- ---------- world_items (reference; §2.26) ----------
-- price NULL = earned-only (visible, never purchasable — 07 §2.6). season_id is a plain uuid for
-- now; the FK lands with the `seasons` table in 0014_quests_seasons. No seed: the launch decor
-- catalogue (~30 items) is Varun's design-pack deliverable (MV-W01-02), added as data rows then.
create table public.world_items (
  id          uuid primary key default gen_random_uuid(),
  sku         text not null unique,
  kind        public.world_item_kind not null,
  name        text not null check (char_length(name) between 1 and 60),
  description text,
  price       integer check (price is null or price >= 0),
  min_level   integer not null default 1 references public.world_levels(level),
  season_id   uuid,
  active      boolean not null default true,
  art_path    text,
  effect      jsonb not null default '{}'::jsonb,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.world_items enable row level security;
create policy "Anyone reads active world items" on public.world_items for select
  using (active or public.is_admin());
grant select on public.world_items to anon, authenticated;

-- ---------- world_garages (1:1 with profiles, created lazily by ensure_world_garage; §2.25) ----------
create table public.world_garages (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  level            integer not null default 1 references public.world_levels(level),
  name             text not null check (char_length(name) between 1 and 40),
  open_mode        public.world_open_mode not null default 'public',
  featured_item_id uuid references public.collection_items(id) on delete set null,
  theme_item_id    uuid references public.world_items(id) on delete set null,
  layout           jsonb not null default '{"version": 1, "slots": [], "decor": []}'::jsonb,
  score            integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger set_updated_at before update on public.world_garages
  for each row execute function public.set_updated_at();

-- Server authority (07 P4): level and score only move inside the RPCs / consumers, which flag
-- themselves with a transaction-local GUC. A direct client UPDATE (allowed by RLS for the owner's
-- name / open_mode / layout / featured car) that touches either column is rejected here.
create or replace function public.world_garages_guard()
returns trigger language plpgsql as $$
begin
  if (new.level is distinct from old.level or new.score is distinct from old.score or new.user_id <> old.user_id)
     and current_setting('mv.world_rpc', true) is distinct from 'on' then
    raise exception 'level_or_score_rpc_only' using errcode = '42501';
  end if;
  return new;
end; $$;
create trigger world_garages_guard before update on public.world_garages
  for each row execute function public.world_garages_guard();

alter table public.world_garages enable row level security;

-- Visibility = open house mode (07 §2.2) + blocks both ways + owner/admin override. `invite`
-- mode is owner-only until world_invites lands in 0013_world_social (W03). Anon sees public
-- garages (share links) — auth.uid() is null there, so is_blocked() is false and the followers
-- branch is unreachable.
create policy "Garage visibility follows open_mode" on public.world_garages for select
  using (
    user_id = auth.uid()
    or public.is_admin()
    or (
      not public.is_blocked(auth.uid(), user_id)
      and (
        open_mode = 'public'
        or (
          open_mode = 'followers'
          and auth.uid() is not null
          and exists (
            select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = user_id
          )
        )
      )
    )
  );
create policy "Owners edit their own garage" on public.world_garages for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- No insert policy: rows are created by ensure_world_garage() only. No delete: cascades from
-- the profile (account deletion flow).
grant select on public.world_garages to anon, authenticated;
grant update on public.world_garages to authenticated;

-- ---------- world_inventory (owned items; §2.27) ----------
-- `durable` is set by the RPC from the item kind (everything except `consumable`), so the
-- one-per-user uniqueness rule can be a partial unique index instead of a cross-table check.
create table public.world_inventory (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  item_id      uuid not null references public.world_items(id),
  acquired_via public.world_acquired_via not null,
  ledger_id    uuid references public.token_ledger(id),
  durable      boolean not null default true,
  created_at   timestamptz not null default now()
);
create index world_inventory_user_idx on public.world_inventory (user_id, created_at desc);
create unique index world_inventory_durable_uidx on public.world_inventory (user_id, item_id) where durable;
alter table public.world_inventory enable row level security;
create policy "Users read their own inventory" on public.world_inventory for select
  using (user_id = auth.uid() or public.is_admin());
grant select on public.world_inventory to authenticated;
-- No insert/update/delete policies, even for admin (same posture as token_ledger): rows come
-- from buy_world_item() / the earn consumer (W04) / admin RPCs only.

-- ---------- feature flags: the eight world* kill switches, all OFF (07 §13 #11, D-018) ----------
-- Same reference-data-in-a-migration precedent as 20260929010000_feature_flags_seed.sql.
insert into public.feature_flags (key, enabled, audience, description) values
  ('world',             false, '{}', 'Collectors World master switch (F-20). Nothing World-facing renders while OFF.'),
  ('world_shop',        false, '{}', 'World shop + buy_* RPCs (F-27). With world_earn = the economy freeze.'),
  ('world_earn',        false, '{}', 'World earn engine: quests, streaks, earn_tokens (F-26). With world_shop = the economy freeze.'),
  ('world_meetups',     false, '{}', 'Virtual meetups (F-23).'),
  ('world_meetups_irl', false, '{}', 'In-person meetup listings (F-24). Country-audience first (UAE).'),
  ('world_races',       false, '{}', 'Racing (F-25).'),
  ('world_clubs',       false, '{}', 'Clubs (F-22).'),
  ('world_presence',    false, '{}', 'Realtime presence in garages/rooms (F-21). Deferred at launch (D-017).')
on conflict (key) do nothing;

notify pgrst, 'reload schema';
