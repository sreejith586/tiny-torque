-- 0002_identity_v2 — MV-S1-01, D-009/D-012/D-015/D-018, 03-data-model.md §2.1-2.2, 2.12, 2.21-2.23
-- profiles columns for handle/country/bio/xp/quotas/onboarding, countries reference (AE/IN
-- pilot only, D-001), public_profiles view (tightens base profiles select to owner-or-admin),
-- invites, follows, feature_flags, domain_events (append-only, monthly partitions).
-- Non-destructive: no column drops. `location`/`photo_url` stay on profiles (dropped later
-- once the media migration lands, D-006 two-release rule).

-- No explicit schema: matches scripts/pg-stub.sql's no-Docker CI path (which pre-installs
-- citext this way) and keeps the type resolvable without relying on search_path containing
-- an "extensions" schema.
create extension if not exists citext;

-- ---------- countries (reference) ----------
create table public.countries (
  code       char(2) primary key,
  name       text not null,
  dial_code  text not null,
  currency   char(3) not null,
  enabled    boolean not null default false
);

alter table public.countries enable row level security;

create policy "Countries are publicly readable"
  on public.countries for select
  using (true);

create policy "Admins manage countries"
  on public.countries for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.countries (code, name, dial_code, currency, enabled) values
  ('AE', 'United Arab Emirates', '+971', 'AED', true),
  ('IN', 'India', '+91', 'INR', true);

-- ---------- profiles: new columns (D-001 pilot = AE/IN only, so country_code FKs to
-- the countries table seeded above rather than an open ISO list) ----------
alter table public.profiles
  add column if not exists handle citext,
  add column if not exists bio text check (char_length(bio) <= 280),
  add column if not exists city text,
  add column if not exists pro_until timestamptz,
  add column if not exists xp integer not null default 0,
  add column if not exists level integer not null default 0,
  add column if not exists scan_quota_used integer not null default 0,
  add column if not exists scan_quota_bonus integer not null default 0,
  add column if not exists scan_quota_reset_at timestamptz not null default now(),
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists tutorial_dismissed_at timestamptz;

alter table public.profiles
  add column if not exists country_code char(2) not null default 'AE' references public.countries(code);

-- backfill handle from display_name, deduped (existing founders-cohort rows have none)
do $$
declare
  r record;
  base text;
  candidate citext;
  suffix int;
begin
  for r in select id, display_name from public.profiles where handle is null order by created_at loop
    base := lower(regexp_replace(coalesce(r.display_name, 'collector'), '[^a-zA-Z0-9]+', '_', 'g'));
    base := trim(both '_' from base);
    if base is null or length(base) < 3 then
      base := 'collector';
    end if;
    base := left(base, 20);
    candidate := base::citext;
    suffix := 0;
    while exists (select 1 from public.profiles where handle = candidate) loop
      suffix := suffix + 1;
      candidate := (left(base, 20) || '_' || suffix::text)::citext;
    end loop;
    update public.profiles set handle = candidate where id = r.id;
  end loop;
end $$;

alter table public.profiles
  alter column handle set not null,
  add constraint profiles_handle_key unique (handle),
  add constraint profiles_handle_format check (handle::text ~ '^[a-z0-9_]{3,24}$');

-- backfill city from the free-text location column (location stays until the garage_v2 drop)
update public.profiles set city = location where city is null and location is not null;

-- existing rows already completed the S0 onboarding form
update public.profiles set onboarding_completed_at = created_at where onboarding_completed_at is null;

-- ---------- profiles: tighten base-table select (D-015 — mobile must never be public) ----------
drop policy if exists "Profiles are publicly readable" on public.profiles;

create policy "Owners and admins read full profile"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

-- ---------- public_profiles view ----------
-- Owned by the migration role (postgres), which owns `profiles` too, so it bypasses the
-- owner-or-admin policy above by design: this view is the ONLY way other users see any
-- profile data. Columns are the 03 §2.1 list minus avatar/banner/rating_avg/rating_count,
-- which don't exist until the media (S2) and reviews-aggregate migrations add their source
-- columns — extend this view with `create or replace view` when those land.
create or replace view public.public_profiles as
select
  id,
  handle,
  display_name,
  account_type,
  store_name,
  country_code,
  city,
  bio,
  level,
  xp,
  created_at,
  (pro_until is not null and pro_until > now()) as is_pro
from public.profiles
where deleted_at is null;

-- ---------- invites (pilot gating, F-01) ----------
create table public.invites (
  code        text primary key,
  created_by  uuid references public.profiles(id) on delete set null,
  max_uses    integer not null default 1,
  used_count  integer not null default 0 check (used_count <= max_uses),
  expires_at  timestamptz,
  cohort      text,
  created_at  timestamptz not null default now()
);

alter table public.invites enable row level security;

-- No authenticated/public select policy: redemption is atomic and goes through a
-- SECURITY DEFINER RPC (MV-S1-05), which bypasses RLS like transition_offer/spend_tokens (D-021).
create policy "Admins manage invites"
  on public.invites for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- follows (schema only in H1, 03 §2.12) ----------
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

alter table public.follows enable row level security;

create policy "Follows are publicly readable"
  on public.follows for select
  using (true);

create policy "Users manage their own follows"
  on public.follows for insert
  with check (follower_id = auth.uid());

create policy "Users remove their own follows"
  on public.follows for delete
  using (follower_id = auth.uid());

-- ---------- feature_flags (D-018 kill switches) ----------
create table public.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  audience    jsonb not null default '{}'::jsonb,
  description text,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

create trigger set_updated_at before update on public.feature_flags
  for each row execute function public.set_updated_at();

create policy "Feature flags are publicly readable"
  on public.feature_flags for select
  using (true);

create policy "Admins manage feature flags"
  on public.feature_flags for insert
  with check (public.is_admin());

create policy "Admins update feature flags"
  on public.feature_flags for update
  using (public.is_admin());

create policy "Admins delete feature flags"
  on public.feature_flags for delete
  using (public.is_admin());

-- ---------- domain_events (D-009, append-only, monthly partitions) ----------
create table public.domain_events (
  id          bigint generated always as identity,
  actor_id    uuid references public.profiles(id) on delete set null,
  type        text not null,
  entity      text not null,
  entity_id   uuid,
  payload     jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  primary key (id, occurred_at)
) partition by range (occurred_at);

create index domain_events_entity_idx on public.domain_events (entity, entity_id);
create index domain_events_type_idx on public.domain_events (type);
create index domain_events_actor_idx on public.domain_events (actor_id);

create table public.domain_events_2026_09 partition of public.domain_events
  for values from ('2026-09-01') to ('2026-10-01');
create table public.domain_events_2026_10 partition of public.domain_events
  for values from ('2026-10-01') to ('2026-11-01');
create table public.domain_events_2026_11 partition of public.domain_events
  for values from ('2026-11-01') to ('2026-12-01');
create table public.domain_events_2026_12 partition of public.domain_events
  for values from ('2026-12-01') to ('2027-01-01');
-- Safety net until the monthly partition-creation job (0011 jobs.sql, S9) exists.
create table public.domain_events_default partition of public.domain_events default;

alter table public.domain_events enable row level security;

create policy "Users log their own events"
  on public.domain_events for insert
  with check (actor_id = auth.uid());

create policy "Admins read all events"
  on public.domain_events for select
  using (public.is_admin());
