-- 0014_quests_seasons — MV-W04-01, F-26, 07-collectors-world.md §2.5 / §3 / §7, D-070 (earn policy),
-- D-071 (server authority), 03-data-model.md §2.36–§2.39.
--
-- Schema half of the earn engine, shipped DARK (`world_earn` stays OFF, D-028): the quest rules
-- table (seeded 6 daily + 6 weekly, PLACEHOLDER rewards per 07 §3.2 — same data-only status as
-- D-064/D-070), per-period progress, seasons + season points, and the two ledger columns FIFO
-- accounting needs. Additive only (D-006): new tables, new enum values, new nullable columns.
--
-- The functions that USE the new enum value ('mixed') live in the next file
-- (20261106092928_earn_engine.sql): a value added inside a transaction can't be referenced in the
-- same transaction (Postgres rule, same split as 0012 → 0013).

-- ---------- enums ----------
create type public.quest_cadence as enum ('daily', 'weekly');

-- A spend funded partly by earned and partly by purchased/promo/adjust credits. Credits keep the
-- four 0012 values; `consumed_earned` (below) carries the exact split.
alter type public.token_ledger_source add value if not exists 'mixed';

-- ---------- token_ledger: FIFO accounting columns (07 §3.3, D-070) ----------
-- `remaining`: on a credit row, the part not yet consumed by a spend / refund / expiry (null on
-- debits). `consumed_earned`: on a debit row, how much of it was funded by earned credits (null on
-- credits). These are the ONLY two columns the ledger ever updates in place — everything else
-- stays append-only — and only the SECURITY DEFINER RPCs in the next file touch them.
alter table public.token_ledger
  add column if not exists remaining integer check (remaining is null or remaining >= 0),
  add column if not exists consumed_earned integer check (consumed_earned is null or consumed_earned >= 0);

-- Earned credits still to expire (the jobs query) and the per-user FIFO scan.
create index if not exists token_ledger_remaining_idx
  on public.token_ledger (user_id, created_at, id) where remaining > 0;

-- The quest consumer recounts a user's events of one type inside a period on every matching event.
create index if not exists domain_events_actor_type_time_idx
  on public.domain_events (actor_id, type, occurred_at);

-- ---------- seasons (§2.38) ----------
create table public.seasons (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  theme      text,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.seasons enable row level security;
create policy "Anyone reads seasons" on public.seasons for select using (true);
grant select on public.seasons to anon, authenticated;
-- No write policies: seasons are data (07 §3.3), created by migration / admin jobs (W05).

-- 0012 left world_items.season_id as a bare uuid "until the seasons table lands in 0014".
alter table public.world_items
  add constraint world_items_season_id_fkey foreign key (season_id)
  references public.seasons(id) on delete set null;

-- PLACEHOLDER season 0 so the /world season line has something to show for the founders cohort.
-- Name/theme/dates are Sreejith's to change (D-086: no design pack; data-only migration).
insert into public.seasons (id, name, theme, starts_at, ends_at) values
  ('00000000-0000-4000-8000-00000000f001', 'Founders'' Season', 'founders',
   '2026-11-10 00:00:00+00', '2027-01-05 00:00:00+00');

-- ---------- season_points (§2.38) ----------
-- Consumer-maintained: points = Σ reward_xp of the user's quests completed inside the season
-- window (07 §2.5 "free season pass track"). Recomputable from quest_progress — see
-- replay_quest_progress() in the next file.
create table public.season_points (
  season_id  uuid not null references public.seasons(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  points     integer not null default 0 check (points >= 0),
  updated_at timestamptz not null default now(),
  primary key (season_id, user_id)
);
alter table public.season_points enable row level security;
create policy "Users read their own season points" on public.season_points for select
  using (user_id = auth.uid() or public.is_admin());
grant select on public.season_points to authenticated;
-- No write policies: the earn consumer / replay function only. Leaderboards (W11) add a view.

-- ---------- quests (reference, seeded; §2.37) ----------
-- `rule` is data the consumer reads: {"kind": "event_count" | "event_days", "event": <domain
-- event type>, "threshold": n}. event_count = number of the user's own events of that type inside
-- the period; event_days = number of distinct UTC days with at least one. Rewards are data too
-- (07 §3.3 "pricing is data"): reward_credits goes through earn_tokens (daily ceiling applies),
-- reward_xp feeds season points now and the F-13 XP rules in MV-W04-03, reward_item_id (null for
-- every seed row) is an earned-only world_items grant on completion.
create table public.quests (
  key            text primary key check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  cadence        public.quest_cadence not null,
  title          text not null check (char_length(title) between 1 and 80),
  description    text,
  rule           jsonb not null,
  reward_xp      integer not null default 0 check (reward_xp >= 0),
  reward_credits integer not null default 0 check (reward_credits >= 0),
  reward_item_id uuid references public.world_items(id) on delete set null,
  active         boolean not null default true,
  sort_order     integer not null default 0 check (sort_order > 0),
  created_at     timestamptz not null default now(),
  check (rule ? 'event' and rule ? 'threshold' and (rule->>'threshold')::integer > 0
         and coalesce(rule->>'kind', 'event_count') in ('event_count', 'event_days'))
);
alter table public.quests enable row level security;
create policy "Anyone reads active quests" on public.quests for select
  using (active or public.is_admin());
grant select on public.quests to anon, authenticated;
-- No write policies: quests change by migration (07 §3.3).

-- The pool is 6 + 6 (08 W04 "keep the quest pool small"); a period shows 3 of each — rows
-- 1–3 or 4–6 of a cadence by period parity (quest_set_index() in the next file), so the set a day
-- or week offers is a pure function of the date and replays identically.
-- PLACEHOLDER rewards: daily +2 credits / weekly +8 credits (07 §3.2), XP per 04 F-13's scale.
insert into public.quests (key, cadence, title, description, rule, reward_xp, reward_credits, sort_order) values
  ('visit_garage',   'daily', 'Visit a garage',             'Open another collector''s garage.',
     '{"kind":"event_count","event":"world.visited","threshold":1}',           10, 2, 1),
  ('give_kudos',     'daily', 'Give kudos',                 'Send kudos to a garage you like.',
     '{"kind":"event_count","event":"world.kudos_given","threshold":1}',       10, 2, 2),
  ('sign_guestbook', 'daily', 'Sign a guestbook',           'Leave a line in someone''s guestbook.',
     '{"kind":"event_count","event":"world.guestbook_posted","threshold":1}',  10, 2, 3),
  ('visit_three',    'daily', 'Visit 3 garages',            'Take a tour of three garages.',
     '{"kind":"event_count","event":"world.visited","threshold":3}',           15, 2, 4),
  ('arrange_garage', 'daily', 'Arrange your garage',        'Save a change to your garage layout.',
     '{"kind":"event_count","event":"world.layout_saved","threshold":1}',      10, 2, 5),
  ('add_car',        'daily', 'Add a car to your garage',   'Log a new diecast in your collection.',
     '{"kind":"event_count","event":"item.created","threshold":1}',            10, 2, 6),

  ('weekly_visits',    'weekly', 'Visit 10 garages this week', 'Ten visits, any garages.',
     '{"kind":"event_count","event":"world.visited","threshold":10}',          40, 8, 1),
  ('weekly_kudos',     'weekly', 'Give kudos 5 times',         'Spread the love across the week.',
     '{"kind":"event_count","event":"world.kudos_given","threshold":5}',       40, 8, 2),
  ('weekly_open_days', 'weekly', 'Open TinyTorque on 5 days',  'Come back on five different days.',
     '{"kind":"event_days","event":"user.opened","threshold":5}',              40, 8, 3),
  ('weekly_guestbook', 'weekly', 'Sign 3 guestbooks',          'Three lines in three guestbooks.',
     '{"kind":"event_count","event":"world.guestbook_posted","threshold":3}',  40, 8, 4),
  ('weekly_add_cars',  'weekly', 'Add 3 cars',                 'Grow your collection by three.',
     '{"kind":"event_count","event":"item.created","threshold":3}',            40, 8, 5),
  ('weekly_garage_update', 'weekly', 'Update your garage',     'Rename, re-theme or re-feature your garage.',
     '{"kind":"event_count","event":"world.garage_updated","threshold":1}',    30, 8, 6);

-- ---------- quest_progress (§2.37) ----------
-- One row per user × quest × period (period_start = UTC day for daily, Monday for weekly).
-- progress is recounted from domain_events on every matching event (never incremented), so a
-- replay yields the same number; completed_at is the occurred_at of the event that crossed the
-- threshold.
create table public.quest_progress (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  quest_key    text not null references public.quests(key),
  period_start date not null,
  progress     integer not null default 0 check (progress >= 0),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, quest_key, period_start)
);
create index quest_progress_period_idx on public.quest_progress (period_start);
alter table public.quest_progress enable row level security;
create policy "Users read their own quest progress" on public.quest_progress for select
  using (user_id = auth.uid() or public.is_admin());
grant select on public.quest_progress to authenticated;
-- No insert/update/delete policies: the domain_events consumer + replay_quest_progress() only.

notify pgrst, 'reload schema';
