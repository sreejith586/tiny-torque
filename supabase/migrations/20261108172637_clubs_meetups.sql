-- 0015_clubs_meetups — MV-W06-01 (virtual meetups), F-23, 07 §2.3 / §3.2 / §6.2 / §7, D-021 (lifecycle
-- only through an RPC), D-069 (the host fee is a platform fee — never a pot, never transferred),
-- D-071 (server authority), D-009 (events), D-077 (`world_meetups` stays OFF — ships dark).
--
-- What lands here:
--   clubs, club_members              schema only (W07 builds the clubs UI + RPCs; RLS read-only here)
--   meetups                          a virtual meetup hosted at the host's garage (in-person columns = 0017, W10)
--   meetup_rsvps                     going / waitlist / declined (+ checked_in reserved for W10), co-hosts as a role,
--                                    host moderation stamps (muted_at / removed_at)
--   meetup_invites                   direct invites behind visibility = invite (host / co-host by handle)
--   meetup_showcase                  ≤ showcase_limit public cars per attendee (votes column reserved for W07)
--   deal_messages                    gains thread `kind` (deal | meetup) + `meetup_id` + `reaction`: the live room
--                                    IS the S6 thread model (same table, same Realtime publication, same component
--                                    pattern) — no second chat table (07 §7 "or messaging threads with kind = meetup")
--   transition_meetup(id, action)    draft → scheduled (host fee via spend_tokens 'spend_meetup_host') → live → ended,
--                                    cancel from draft / scheduled (fee refunded via credit_tokens when ≥ 24 h before start)
--   rsvp_meetup, set_meetup_showcase, invite_to_meetup, set_meetup_cohost, moderate_meetup_attendee
--   world_job_meetup_transitions / world_job_meetup_reminders + run_meetup_jobs(job, at, source) — the same
--                                    job_runs / dispatcher / guarded-pg_cron pattern as 0014d, in a SEPARATE dispatcher
--                                    so neither this file nor S9's jobs migration has to redefine run_world_job
--   notification kinds               meetup_invite, meetup_reminder, meetup_live, meetup_cancelled
--
-- PLACEHOLDER numbers (07 §3.2, same status as D-064): host fee 5 / 10 / 20 credits by capacity (≤ 10 / ≤ 25 / more);
-- capacity cap = the host garage level's host_cap, +50 % for Pro (D-003 Pro); showcase 3 cars per attendee.
-- Capacity 0 (level 1 "Shed") means the user cannot host yet — hosting needs level 2+ (D-076 spirit).

-- ---------- enums ----------
create type public.club_join_mode     as enum ('open', 'apply', 'invite');
create type public.club_member_role   as enum ('owner', 'admin', 'member');
create type public.club_member_status as enum ('active', 'pending', 'banned');
create type public.meetup_kind        as enum ('virtual', 'in_person');
create type public.meetup_visibility  as enum ('public', 'followers', 'club', 'invite');
create type public.meetup_status      as enum ('draft', 'scheduled', 'live', 'ended', 'cancelled');
create type public.meetup_rsvp_status as enum ('going', 'waitlist', 'declined', 'checked_in');

-- Additive enum values (D-006). Only referenced inside plpgsql bodies below (resolved at run time), never in a
-- policy or SQL-language function in this file — a value added in a transaction can't be used in that transaction.
alter type public.notification_type add value if not exists 'meetup_invite';
alter type public.notification_type add value if not exists 'meetup_reminder';
alter type public.notification_type add value if not exists 'meetup_live';
alter type public.notification_type add value if not exists 'meetup_cancelled';
alter type public.entitlement_grant_kind add value if not exists 'meetup_host';

-- ---------- clubs + club_members (schema only; §2.43) ----------
create table public.clubs (
  id              uuid primary key default gen_random_uuid(),
  slug            citext not null unique check (slug ~ '^[a-z0-9_]{3,24}$'),
  name            text not null check (char_length(name) between 2 and 60),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  join_mode       public.club_join_mode not null default 'open',
  country_code    char(2) references public.countries(code),
  description     text check (description is null or char_length(description) <= 500),
  banner_media_id uuid references public.media(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger set_updated_at before update on public.clubs
  for each row execute function public.set_updated_at();
create index clubs_owner_idx on public.clubs (owner_id);
alter table public.clubs enable row level security;
create policy "Anyone reads clubs" on public.clubs for select using (true);
grant select on public.clubs to anon, authenticated;
-- No write policies: W07's club RPCs are the only writers.

create table public.club_members (
  club_id   uuid not null references public.clubs(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      public.club_member_role not null default 'member',
  status    public.club_member_status not null default 'active',
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index club_members_user_idx on public.club_members (user_id);
alter table public.club_members enable row level security;

create or replace function public.is_club_member(p_club uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and exists (
    select 1 from public.club_members cm
    where cm.club_id = p_club and cm.user_id = p_user and cm.status = 'active'
  );
$$;
grant execute on function public.is_club_member(uuid, uuid) to anon, authenticated;

create policy "Members read their club's roster" on public.club_members for select
  using (user_id = auth.uid() or public.is_admin() or public.is_club_member(club_id, auth.uid()));
grant select on public.club_members to authenticated;
-- No write policies (W07).

-- ---------- meetups (§2.44) ----------
create table public.meetups (
  id               uuid primary key default gen_random_uuid(),
  host_id          uuid not null references public.profiles(id) on delete cascade,
  club_id          uuid references public.clubs(id) on delete set null,
  garage_user_id   uuid references public.world_garages(user_id) on delete set null,
  kind             public.meetup_kind not null default 'virtual',
  title            text not null check (char_length(title) between 3 and 80),
  theme            text check (theme is null or char_length(theme) <= 60),
  description      text check (description is null or char_length(description) <= 1000),
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  capacity         integer not null check (capacity between 2 and 500),
  showcase_limit   integer not null default 3 check (showcase_limit between 1 and 5),
  visibility       public.meetup_visibility not null default 'public',
  status           public.meetup_status not null default 'draft',
  fee_paid         integer not null default 0 check (fee_paid >= 0),
  fee_ledger_id    uuid references public.token_ledger(id) on delete set null,
  refund_ledger_id uuid references public.token_ledger(id) on delete set null,
  scheduled_at     timestamptz,
  started_at       timestamptz,
  ended_at         timestamptz,
  cancelled_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint meetups_time_order     check (ends_at > starts_at and ends_at <= starts_at + interval '6 hours'),
  constraint meetups_club_visibility check (visibility <> 'club' or club_id is not null)
);
create trigger set_updated_at before update on public.meetups
  for each row execute function public.set_updated_at();
create index meetups_status_starts_idx on public.meetups (status, starts_at);
create index meetups_host_idx on public.meetups (host_id, starts_at desc);
create index meetups_club_idx on public.meetups (club_id) where club_id is not null;
alter table public.meetups enable row level security;

create table public.meetup_rsvps (
  meetup_id     uuid not null references public.meetups(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  status        public.meetup_rsvp_status not null default 'going',
  role          text not null default 'attendee' check (role in ('attendee', 'cohost')),
  muted_at      timestamptz,
  removed_at    timestamptz,
  checked_in_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (meetup_id, user_id)
);
create trigger set_updated_at before update on public.meetup_rsvps
  for each row execute function public.set_updated_at();
create index meetup_rsvps_user_idx on public.meetup_rsvps (user_id, created_at desc);
alter table public.meetup_rsvps enable row level security;

create table public.meetup_invites (
  meetup_id  uuid not null references public.meetups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (meetup_id, user_id)
);
create index meetup_invites_user_idx on public.meetup_invites (user_id);
alter table public.meetup_invites enable row level security;

create table public.meetup_showcase (
  id         uuid primary key default gen_random_uuid(),
  meetup_id  uuid not null references public.meetups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  item_id    uuid not null references public.collection_items(id) on delete cascade,
  votes      integer not null default 0 check (votes >= 0),
  position   integer not null default 0 check (position between 0 and 9),
  created_at timestamptz not null default now(),
  unique (meetup_id, item_id)
);
create index meetup_showcase_meetup_idx on public.meetup_showcase (meetup_id, user_id, position);
alter table public.meetup_showcase enable row level security;

-- ---------- visibility helpers (one rule, used by policies and RPCs — the 0013b pattern) ----------
-- Host or co-host of a meetup (co-host = an rsvp row with role 'cohost' that the host has not removed).
create or replace function public.is_meetup_host(p_meetup uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and exists (
    select 1 from public.meetups m where m.id = p_meetup and m.host_id = p_user
    union all
    select 1 from public.meetup_rsvps r
    where r.meetup_id = p_meetup and r.user_id = p_user and r.role = 'cohost' and r.removed_at is null
  );
$$;
grant execute on function public.is_meetup_host(uuid, uuid) to anon, authenticated;

-- Who may see a meetup: host / co-host / admin always; a draft is theirs alone. Otherwise no block with the
-- host (both ways) and: public (anon included — share links later), followers of the host, active members
-- of the club, directly invited, or anyone who already holds an rsvp row (they keep seeing what they joined).
create or replace function public.meetup_visible(p_meetup uuid, p_viewer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.meetups m
    where m.id = p_meetup
      and (
        public.is_meetup_host(m.id, p_viewer)
        or public.is_admin()
        or (
          m.status <> 'draft'
          and not public.is_blocked(p_viewer, m.host_id)
          and (
            m.visibility = 'public'
            or (m.visibility = 'followers' and p_viewer is not null and exists (
                  select 1 from public.follows f where f.follower_id = p_viewer and f.followee_id = m.host_id))
            or (m.visibility = 'club' and public.is_club_member(m.club_id, p_viewer))
            or (p_viewer is not null and exists (
                  select 1 from public.meetup_invites i where i.meetup_id = m.id and i.user_id = p_viewer))
            or (p_viewer is not null and exists (
                  select 1 from public.meetup_rsvps r where r.meetup_id = m.id and r.user_id = p_viewer and r.removed_at is null))
          )
        )
      )
  );
$$;
grant execute on function public.meetup_visible(uuid, uuid) to anon, authenticated;

-- Who is "in the room": host / co-host, or an attendee the host has not removed whose rsvp is going / checked in.
create or replace function public.meetup_room_member(p_meetup uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and (
    public.is_meetup_host(p_meetup, p_user)
    or exists (
      select 1 from public.meetup_rsvps r
      where r.meetup_id = p_meetup and r.user_id = p_user and r.removed_at is null
        and r.status in ('going', 'checked_in')
    )
  );
$$;
grant execute on function public.meetup_room_member(uuid, uuid) to authenticated;

-- Hosting capacity for a user: the garage level's host_cap, +50 % for Pro (07 §2.3 "capacity by host garage
-- level"; D-003 Pro). 0 without a garage or at level 1 ("Shed", host_cap 0) — not eligible to host yet.
create or replace function public.meetup_host_cap(p_user uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce((
    select floor(l.host_cap * (case when public.is_pro(p_user) then 1.5 else 1.0 end))::integer
    from public.world_garages g join public.world_levels l on l.level = g.level
    where g.user_id = p_user
  ), 0);
$$;
grant execute on function public.meetup_host_cap(uuid) to authenticated;

-- PLACEHOLDER host fee by capacity (07 §3.2: 5 / 10 / 20). A platform fee — a sink, never a pot (D-069).
create or replace function public.meetup_host_fee(p_capacity integer)
returns integer language sql immutable as $$
  select case when p_capacity <= 10 then 5 when p_capacity <= 25 then 10 else 20 end;
$$;
grant execute on function public.meetup_host_fee(integer) to anon, authenticated;

-- ---------- policies ----------
create policy "Meetup visibility" on public.meetups for select
  using (public.meetup_visible(id, auth.uid()));
-- The host edits the descriptive columns while the meetup is editable; the guard below keeps capacity,
-- timing and status honest. Column-level grant: status / fee / stamps are not even grantable targets.
create policy "Host edits their meetup" on public.meetups for update
  using (host_id = auth.uid()) with check (host_id = auth.uid());
grant select on public.meetups to anon, authenticated;
grant update (title, theme, description, starts_at, ends_at, capacity, visibility, showcase_limit, club_id)
  on public.meetups to authenticated;
-- No insert / delete policies: create_meetup() creates, cancel is a transition.

create policy "Attendee list follows meetup visibility" on public.meetup_rsvps for select
  using (public.meetup_visible(meetup_id, auth.uid()));
grant select on public.meetup_rsvps to authenticated;

create policy "Host and invitee read meetup invites" on public.meetup_invites for select
  using (user_id = auth.uid() or public.is_meetup_host(meetup_id, auth.uid()) or public.is_admin());
grant select on public.meetup_invites to authenticated;

create policy "Showcase follows meetup visibility" on public.meetup_showcase for select
  using (public.meetup_visible(meetup_id, auth.uid()));
grant select on public.meetup_showcase to anon, authenticated;
-- rsvps / invites / showcase: no write policies — RPC only.

-- Guard: status, host, kind, fee and the lifecycle stamps move only inside the RPCs (GUC `mv.meetup_rpc`, the
-- 0012 world_garages_guard pattern). A host's direct edit must keep the meetup in an editable state, the
-- capacity within their cap and not below the people already going, and the start in the future.
create or replace function public.meetups_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_going integer;
begin
  if current_setting('mv.meetup_rpc', true) is distinct from 'on' then
    if new.status is distinct from old.status or new.host_id <> old.host_id or new.kind is distinct from old.kind
       or new.fee_paid is distinct from old.fee_paid or new.fee_ledger_id is distinct from old.fee_ledger_id
       or new.refund_ledger_id is distinct from old.refund_ledger_id
       or new.scheduled_at is distinct from old.scheduled_at or new.started_at is distinct from old.started_at
       or new.ended_at is distinct from old.ended_at or new.cancelled_at is distinct from old.cancelled_at
       or new.garage_user_id is distinct from old.garage_user_id then
      raise exception 'rpc_only_column' using errcode = '42501';
    end if;
    if old.status not in ('draft', 'scheduled') then raise exception 'meetup_closed' using errcode = 'P0001'; end if;
    if new.starts_at is distinct from old.starts_at and new.starts_at <= now() then
      raise exception 'starts_in_past' using errcode = 'P0001';
    end if;
    if new.capacity is distinct from old.capacity then
      if new.capacity > public.meetup_host_cap(new.host_id) then raise exception 'capacity_too_high' using errcode = 'P0001'; end if;
      select count(*) into v_going from public.meetup_rsvps
        where meetup_id = new.id and removed_at is null and status in ('going', 'checked_in');
      if new.capacity < v_going then raise exception 'capacity_below_going' using errcode = 'P0001'; end if;
    end if;
    if new.visibility = 'club' and not public.is_club_member(new.club_id, new.host_id) then
      raise exception 'not_club_member' using errcode = 'P0001';
    end if;
  end if;
  return new;
end; $$;
create trigger meetups_guard before update on public.meetups
  for each row execute function public.meetups_guard();

-- ---------- deal_messages becomes the thread table for meetup rooms too (07 §7, 02 ADR-05 "reuse S6") ----------
-- kind = 'deal' rows are exactly what 0008 created (offer_id set). kind = 'meetup' rows carry meetup_id; a
-- `reaction` key renders as a floating chip instead of a bubble. Same Realtime publication (0008 added the
-- table), so the room subscribes to `deal_messages` filtered by meetup_id, exactly like the deal thread.
alter table public.deal_messages
  alter column offer_id drop not null,
  add column kind      text not null default 'deal' check (kind in ('deal', 'meetup')),
  add column meetup_id uuid references public.meetups(id) on delete cascade,
  add column reaction  text check (reaction is null or reaction in ('thumbs', 'fire', 'clap', 'heart', 'flag'));
alter table public.deal_messages add constraint deal_messages_thread_target check (
  (kind = 'deal' and offer_id is not null and meetup_id is null)
  or (kind = 'meetup' and meetup_id is not null and offer_id is null)
);
create index deal_messages_meetup_idx on public.deal_messages (meetup_id, created_at) where meetup_id is not null;

-- Room read: members only ("a non-attendee cannot read the room", F-23 AC). The 0008 policies keep governing
-- deal rows (their `exists offers …` is false for meetup rows); these two only match meetup rows.
create policy "Room members read the room" on public.deal_messages for select
  using (kind = 'meetup' and public.meetup_room_member(meetup_id, auth.uid()));
-- Room write: the meetup is live, the sender is a member, not muted, and not blocked with the host.
create policy "Room members post while live" on public.deal_messages for insert
  with check (
    kind = 'meetup' and sender_id = auth.uid()
    and public.meetup_room_member(meetup_id, auth.uid())
    and exists (
      select 1 from public.meetups m
      where m.id = meetup_id and m.status = 'live' and not public.is_blocked(auth.uid(), m.host_id)
    )
    and not exists (
      select 1 from public.meetup_rsvps r
      where r.meetup_id = deal_messages.meetup_id and r.user_id = auth.uid() and r.muted_at is not null
    )
  );

-- message.sent now names the thread it belongs to (entity offer | meetup). Redefined in full (D-006).
create or replace function public.emit_message_sent_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'meetup' then
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (new.sender_id, 'message.sent', 'meetup', new.meetup_id,
              jsonb_build_object('message_id', new.id, 'reaction', new.reaction));
  else
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (new.sender_id, 'message.sent', 'offer', new.offer_id, jsonb_build_object('message_id', new.id));
  end if;
  return new;
end; $$;

-- Room rate limit (07 §6.6): 20 messages or reactions per minute per sender per room.
create or replace function public.check_meetup_message_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if new.kind <> 'meetup' then return new; end if;
  select count(*) into n from public.deal_messages
    where meetup_id = new.meetup_id and sender_id = new.sender_id and created_at > now() - interval '1 minute';
  if n >= 20 then raise exception 'message_rate_limit' using errcode = 'P0001'; end if;
  return new;
end; $$;
create trigger check_meetup_message_rate_limit before insert on public.deal_messages
  for each row execute function public.check_meetup_message_rate_limit();

-- RSVP rate limit: 30 rsvp writes per hour per user (07 §3.3 "rate limits on … RSVP").
create or replace function public.check_meetup_rsvp_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  select count(*) into n from public.meetup_rsvps
    where user_id = new.user_id and created_at > now() - interval '1 hour';
  if n >= 30 then raise exception 'rsvp_rate_limit' using errcode = 'P0001'; end if;
  return new;
end; $$;
create trigger check_meetup_rsvp_rate_limit before insert on public.meetup_rsvps
  for each row execute function public.check_meetup_rsvp_rate_limit();

-- ---------- create_meetup: a draft at the host's garage ----------
create or replace function public.create_meetup(
  p_title       text,
  p_starts_at   timestamptz,
  p_ends_at     timestamptz,
  p_capacity    integer,
  p_visibility  public.meetup_visibility default 'public',
  p_theme       text default null,
  p_description text default null,
  p_club_id     uuid default null
)
returns public.meetups
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_cap integer;
  v_row public.meetups;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  perform public.ensure_world_garage();
  v_cap := public.meetup_host_cap(v_uid);
  if v_cap <= 0 then raise exception 'host_not_eligible' using errcode = 'P0001'; end if;
  if p_capacity is null or p_capacity > v_cap then raise exception 'capacity_too_high' using errcode = 'P0001'; end if;
  if p_starts_at is null or p_starts_at <= now() then raise exception 'starts_in_past' using errcode = 'P0001'; end if;
  if p_visibility = 'club' and not public.is_club_member(p_club_id, v_uid) then
    raise exception 'not_club_member' using errcode = 'P0001';
  end if;

  insert into public.meetups (host_id, club_id, garage_user_id, title, theme, description, starts_at, ends_at,
                              capacity, visibility)
    values (v_uid, case when p_visibility = 'club' then p_club_id else null end, v_uid,
            trim(p_title), nullif(trim(p_theme), ''), nullif(trim(p_description), ''),
            p_starts_at, p_ends_at, p_capacity, p_visibility)
    returning * into v_row;

  perform public.emit_event(v_uid, 'meetup.created', 'meetup', v_row.id, jsonb_build_object(
    'capacity', v_row.capacity, 'visibility', v_row.visibility, 'starts_at', v_row.starts_at));
  return v_row;
end; $$;
grant execute on function public.create_meetup(text, timestamptz, timestamptz, integer, public.meetup_visibility, text, text, uuid)
  to authenticated;

-- ---------- transition_meetup: the only way status moves (D-021 pattern, modelled on transition_offer) ----------
-- schedule  host only, draft → scheduled. Charges the host fee through spend_tokens (key `meetup_host:<id>` — a
--           double submit cannot charge twice), records the ledger row on the meetup.
-- start     host / co-host from 15 min before start, or the backend (jobs) at start; scheduled → live.
--           Notifies everyone going (`meetup_live`).
-- end       host / co-host / backend; live → ended. Emits meetup.ended with the attendee count (the W05
--           `world_host` badge and W07's rewards consume it).
-- cancel    host only, draft / scheduled → cancelled. A scheduled meetup cancelled ≥ 24 h before its start gets
--           the fee back through credit_tokens (reason refund, key `meetup_refund:<id>`); later cancels keep it.
--           Notifies everyone going (`meetup_cancelled`).
create or replace function public.transition_meetup(p_id uuid, p_action text)
returns public.meetups
language plpgsql security definer set search_path = public as $$
declare
  v_m        public.meetups;
  v_uid      uuid := auth.uid();
  v_backend  boolean := public.mv_is_backend_caller();
  v_is_host  boolean;
  v_is_staff boolean;
  v_grant    public.entitlement_grants;
  v_ledger   public.token_ledger;
  v_fee      integer;
  v_count    integer;
  v_refunded boolean := false;
  r          record;
begin
  select * into v_m from public.meetups where id = p_id for update;
  if not found then raise exception 'meetup_not_found' using errcode = 'P0002'; end if;
  v_is_host  := v_uid is not null and v_uid = v_m.host_id;
  v_is_staff := public.is_meetup_host(p_id, v_uid);

  perform set_config('mv.meetup_rpc', 'on', true);

  if p_action = 'schedule' then
    if not v_is_host then raise exception 'not_authorized' using errcode = '42501'; end if;
    if v_m.status <> 'draft' then raise exception 'invalid_transition' using errcode = 'P0001'; end if;
    if v_m.starts_at <= now() then raise exception 'starts_in_past' using errcode = 'P0001'; end if;
    if v_m.capacity > public.meetup_host_cap(v_uid) then raise exception 'capacity_too_high' using errcode = 'P0001'; end if;
    v_fee := public.meetup_host_fee(v_m.capacity);
    -- spend_tokens raises insufficient_balance itself; nothing below runs then.
    v_grant := public.spend_tokens('spend_meetup_host', v_fee, 'meetup_host', 1, null,
                                   'meetup', v_m.id, 'meetup_host:' || v_m.id::text);
    update public.meetups
      set status = 'scheduled', scheduled_at = now(), fee_paid = v_fee, fee_ledger_id = v_grant.ledger_id
      where id = v_m.id;
    perform public.emit_event(v_uid, 'meetup.scheduled', 'meetup', v_m.id, jsonb_build_object(
      'fee', v_fee, 'capacity', v_m.capacity, 'starts_at', v_m.starts_at, 'ledger_id', v_grant.ledger_id));

  elsif p_action = 'start' then
    if not (v_backend or v_is_staff) then raise exception 'not_authorized' using errcode = '42501'; end if;
    if v_m.status <> 'scheduled' then raise exception 'invalid_transition' using errcode = 'P0001'; end if;
    if not v_backend and now() < v_m.starts_at - interval '15 minutes' then
      raise exception 'too_early' using errcode = 'P0001';
    end if;
    update public.meetups set status = 'live', started_at = now() where id = v_m.id;
    perform public.emit_event(v_uid, 'meetup.started', 'meetup', v_m.id,
      jsonb_build_object('by', case when v_backend then 'jobs' else 'host' end));
    for r in
      select user_id from public.meetup_rsvps
      where meetup_id = v_m.id and removed_at is null and status in ('going', 'checked_in')
        and user_id is distinct from v_uid
    loop
      insert into public.notifications (user_id, type, payload)
        values (r.user_id, 'meetup_live', jsonb_build_object('meetup_id', v_m.id, 'title', v_m.title));
    end loop;

  elsif p_action = 'end' then
    if not (v_backend or v_is_staff) then raise exception 'not_authorized' using errcode = '42501'; end if;
    if v_m.status <> 'live' then raise exception 'invalid_transition' using errcode = 'P0001'; end if;
    select count(*) into v_count from public.meetup_rsvps
      where meetup_id = v_m.id and removed_at is null and status in ('going', 'checked_in');
    update public.meetups set status = 'ended', ended_at = now() where id = v_m.id;
    perform public.emit_event(coalesce(v_uid, v_m.host_id), 'meetup.ended', 'meetup', v_m.id, jsonb_build_object(
      'host_id', v_m.host_id, 'attendees', v_count, 'by', case when v_backend then 'jobs' else 'host' end));

  elsif p_action = 'cancel' then
    if not v_is_host then raise exception 'not_authorized' using errcode = '42501'; end if;
    if v_m.status not in ('draft', 'scheduled') then raise exception 'invalid_transition' using errcode = 'P0001'; end if;
    if v_m.status = 'scheduled' and v_m.fee_paid > 0 and v_m.starts_at - now() >= interval '24 hours' then
      v_ledger := public.credit_tokens(v_m.host_id, v_m.fee_paid, 'refund', 'meetup', v_m.id,
                                       'meetup_refund:' || v_m.id::text);
      v_refunded := true;
      update public.meetups set refund_ledger_id = v_ledger.id where id = v_m.id;
    end if;
    update public.meetups set status = 'cancelled', cancelled_at = now() where id = v_m.id;
    perform public.emit_event(v_uid, 'meetup.cancelled', 'meetup', v_m.id, jsonb_build_object(
      'fee', v_m.fee_paid, 'refunded', v_refunded, 'from', v_m.status));
    for r in
      select user_id from public.meetup_rsvps
      where meetup_id = v_m.id and removed_at is null and status in ('going', 'waitlist', 'checked_in')
        and user_id is distinct from v_uid
    loop
      insert into public.notifications (user_id, type, payload)
        values (r.user_id, 'meetup_cancelled', jsonb_build_object('meetup_id', v_m.id, 'title', v_m.title));
    end loop;

  else
    raise exception 'unknown_action: %', p_action using errcode = 'P0001';
  end if;

  perform set_config('mv.meetup_rpc', 'off', true);
  select * into v_m from public.meetups where id = p_id;
  return v_m;
end; $$;
grant execute on function public.transition_meetup(uuid, text) to authenticated, service_role;

-- ---------- rsvp_meetup: going (or waitlist when full) / declined; attending is free (07 §2.3) ----------
-- Visibility is the gate (a hidden meetup reads as not found, like 0013b's garages); the host is implicit and
-- cannot rsvp; someone the host removed cannot come back. Declining a going seat promotes the earliest
-- waitlisted attendee. Emits meetup.rsvp for every status change.
create or replace function public.rsvp_meetup(p_id uuid, p_status text default 'going')
returns public.meetup_rsvps
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_m     public.meetups;
  v_row   public.meetup_rsvps;
  v_going integer;
  v_next  public.meetup_rsvp_status;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_status not in ('going', 'declined') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  select * into v_m from public.meetups where id = p_id for update;
  if not found or not public.meetup_visible(p_id, v_uid) then raise exception 'meetup_not_found' using errcode = 'P0002'; end if;
  if v_m.host_id = v_uid then raise exception 'host_cannot_rsvp' using errcode = 'P0001'; end if;
  if v_m.status not in ('scheduled', 'live') then raise exception 'meetup_closed' using errcode = 'P0001'; end if;

  select * into v_row from public.meetup_rsvps where meetup_id = p_id and user_id = v_uid;
  if found and v_row.removed_at is not null then raise exception 'removed_by_host' using errcode = 'P0001'; end if;

  if p_status = 'going' then
    if found and v_row.status in ('going', 'checked_in', 'waitlist') then return v_row; end if;
    select count(*) into v_going from public.meetup_rsvps
      where meetup_id = p_id and removed_at is null and status in ('going', 'checked_in');
    v_next := (case when v_going < v_m.capacity then 'going' else 'waitlist' end)::public.meetup_rsvp_status;
    insert into public.meetup_rsvps (meetup_id, user_id, status)
      values (p_id, v_uid, v_next)
      on conflict (meetup_id, user_id) do update set status = excluded.status
      returning * into v_row;
    perform public.emit_event(v_uid, 'meetup.rsvp', 'meetup', p_id,
      jsonb_build_object('status', v_row.status, 'host_id', v_m.host_id));
    return v_row;
  end if;

  -- declined
  if not found then
    insert into public.meetup_rsvps (meetup_id, user_id, status) values (p_id, v_uid, 'declined') returning * into v_row;
  elsif v_row.status = 'declined' then
    return v_row;
  else
    update public.meetup_rsvps set status = 'declined' where meetup_id = p_id and user_id = v_uid returning * into v_row;
    if v_row.role = 'attendee' then
      perform public.meetup_promote_waitlist(p_id);
    end if;
  end if;
  perform public.emit_event(v_uid, 'meetup.rsvp', 'meetup', p_id,
    jsonb_build_object('status', 'declined', 'host_id', v_m.host_id));
  return v_row;
end; $$;
grant execute on function public.rsvp_meetup(uuid, text) to authenticated;

-- Promote the earliest waitlisted attendee while seats are free. Internal (called by rsvp / kick).
create or replace function public.meetup_promote_waitlist(p_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_m        public.meetups;
  v_going    integer;
  v_promoted integer := 0;
  r          record;
begin
  select * into v_m from public.meetups where id = p_id;
  if not found or v_m.status not in ('scheduled', 'live') then return 0; end if;
  select count(*) into v_going from public.meetup_rsvps
    where meetup_id = p_id and removed_at is null and status in ('going', 'checked_in');
  for r in
    select user_id from public.meetup_rsvps
    where meetup_id = p_id and removed_at is null and status = 'waitlist'
    order by created_at
  loop
    exit when v_going >= v_m.capacity;
    update public.meetup_rsvps set status = 'going' where meetup_id = p_id and user_id = r.user_id;
    perform public.emit_event(r.user_id, 'meetup.rsvp', 'meetup', p_id,
      jsonb_build_object('status', 'going', 'promoted', true, 'host_id', v_m.host_id));
    v_going := v_going + 1;
    v_promoted := v_promoted + 1;
  end loop;
  return v_promoted;
end; $$;
revoke execute on function public.meetup_promote_waitlist(uuid) from public, anon, authenticated;

-- ---------- set_meetup_showcase: an attendee's ≤ showcase_limit public cars (07 §2.3) ----------
-- Replaces the caller's picks in one go. Every item must be the caller's own, public and not deleted (the
-- same rule the garage layout enforces, 07 §6.2). Open while the meetup is scheduled or live.
create or replace function public.set_meetup_showcase(p_id uuid, p_item_ids uuid[])
returns setof public.meetup_showcase
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_m     public.meetups;
  v_ids   uuid[] := coalesce(p_item_ids, '{}'::uuid[]);
  v_n     integer;
  v_ok    integer;
  i       integer;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_m from public.meetups where id = p_id for update;
  if not found or not public.meetup_visible(p_id, v_uid) then raise exception 'meetup_not_found' using errcode = 'P0002'; end if;
  if v_m.status not in ('scheduled', 'live') then raise exception 'meetup_closed' using errcode = 'P0001'; end if;
  if not public.meetup_room_member(p_id, v_uid) then raise exception 'not_attending' using errcode = 'P0001'; end if;

  select count(distinct x) into v_n from unnest(v_ids) x;
  if v_n > v_m.showcase_limit then raise exception 'too_many_items' using errcode = 'P0001'; end if;
  if v_n > 0 then
    select count(*) into v_ok from public.collection_items c
      where c.id = any (v_ids) and c.owner_id = v_uid and c.deleted_at is null and c.is_public;
    if v_ok < v_n then raise exception 'item_not_public' using errcode = 'P0001'; end if;
  end if;

  delete from public.meetup_showcase where meetup_id = p_id and user_id = v_uid and not (item_id = any (v_ids));
  for i in 1 .. coalesce(array_length(v_ids, 1), 0) loop
    insert into public.meetup_showcase (meetup_id, user_id, item_id, position)
      values (p_id, v_uid, v_ids[i], i - 1)
      on conflict (meetup_id, item_id) do update set position = excluded.position;
  end loop;

  perform public.emit_event(v_uid, 'meetup.showcase_updated', 'meetup', p_id,
    jsonb_build_object('count', v_n, 'host_id', v_m.host_id));
  return query select * from public.meetup_showcase where meetup_id = p_id and user_id = v_uid order by position;
end; $$;
grant execute on function public.set_meetup_showcase(uuid, uuid[]) to authenticated;

-- ---------- invite_to_meetup: host / co-host invites a collector by handle ----------
-- Works for any visibility (an invite also unlocks followers / club / invite-only meetups for that person).
-- Scheduled or live only — an invite to a draft would deep-link to a 404. 50 invites per meetup. The invitee
-- gets a `meetup_invite` notification (payload carries what the inbox needs; never PII).
create or replace function public.invite_to_meetup(p_id uuid, p_handle text)
returns public.meetup_invites
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_m       public.meetups;
  v_invitee uuid;
  v_row     public.meetup_invites;
  v_n       integer;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_m from public.meetups where id = p_id for update;
  if not found then raise exception 'meetup_not_found' using errcode = 'P0002'; end if;
  if not public.is_meetup_host(p_id, v_uid) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if v_m.status not in ('scheduled', 'live') then raise exception 'meetup_closed' using errcode = 'P0001'; end if;

  select id into v_invitee from public.profiles
    where handle = lower(trim(p_handle)) and deleted_at is null;
  if v_invitee is null or v_invitee = v_m.host_id or public.is_blocked(v_invitee, v_m.host_id) then
    raise exception 'invitee_not_found' using errcode = 'P0002';
  end if;
  select count(*) into v_n from public.meetup_invites where meetup_id = p_id;
  if v_n >= 50 then raise exception 'invite_limit' using errcode = 'P0001'; end if;

  insert into public.meetup_invites (meetup_id, user_id, invited_by) values (p_id, v_invitee, v_uid)
    on conflict (meetup_id, user_id) do nothing;
  select * into v_row from public.meetup_invites where meetup_id = p_id and user_id = v_invitee;
  if not exists (select 1 from public.notifications
                 where user_id = v_invitee and type = 'meetup_invite' and payload ->> 'meetup_id' = p_id::text) then
    insert into public.notifications (user_id, type, payload)
      values (v_invitee, 'meetup_invite', jsonb_build_object('meetup_id', v_m.id, 'title', v_m.title, 'starts_at', v_m.starts_at));
    perform public.emit_event(v_uid, 'meetup.invited', 'meetup', p_id,
      jsonb_build_object('invitee_id', v_invitee, 'host_id', v_m.host_id));
  end if;
  return v_row;
end; $$;
grant execute on function public.invite_to_meetup(uuid, text) to authenticated;

-- ---------- set_meetup_cohost: host promotes / demotes a collector by handle (07 §2.3 "co-hosts allowed") ----------
-- A co-host holds a going seat with role 'cohost' (counts towards capacity like anyone in the room) and may
-- start / end the meetup, invite, moderate attendees and set a showcase. Only the host appoints co-hosts.
create or replace function public.set_meetup_cohost(p_id uuid, p_handle text, p_on boolean)
returns public.meetup_rsvps
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_m    public.meetups;
  v_user uuid;
  v_row  public.meetup_rsvps;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_m from public.meetups where id = p_id for update;
  if not found then raise exception 'meetup_not_found' using errcode = 'P0002'; end if;
  if v_m.host_id <> v_uid then raise exception 'not_authorized' using errcode = '42501'; end if;
  if v_m.status in ('ended', 'cancelled') then raise exception 'meetup_closed' using errcode = 'P0001'; end if;
  select id into v_user from public.profiles where handle = lower(trim(p_handle)) and deleted_at is null;
  if v_user is null or v_user = v_uid or public.is_blocked(v_user, v_uid) then
    raise exception 'invitee_not_found' using errcode = 'P0002';
  end if;

  if p_on then
    insert into public.meetup_rsvps (meetup_id, user_id, status, role) values (p_id, v_user, 'going', 'cohost')
      on conflict (meetup_id, user_id) do update set role = 'cohost', status = 'going', removed_at = null, muted_at = null
      returning * into v_row;
  else
    update public.meetup_rsvps set role = 'attendee' where meetup_id = p_id and user_id = v_user returning * into v_row;
    if not found then raise exception 'not_attending' using errcode = 'P0001'; end if;
  end if;
  perform public.emit_event(v_uid, 'meetup.moderated', 'meetup', p_id,
    jsonb_build_object('action', case when p_on then 'cohost_added' else 'cohost_removed' end, 'user_id', v_user));
  return v_row;
end; $$;
grant execute on function public.set_meetup_cohost(uuid, text, boolean) to authenticated;

-- ---------- moderate_meetup_attendee: mute / unmute / kick (07 §9 room abuse; 06 §5 runbook) ----------
-- Host and co-hosts moderate attendees; only the host moderates a co-host. A kicked attendee loses the seat
-- (declined + removed_at) and cannot rsvp again; their seat goes to the waitlist.
create or replace function public.moderate_meetup_attendee(p_id uuid, p_user uuid, p_action text)
returns public.meetup_rsvps
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_m   public.meetups;
  v_row public.meetup_rsvps;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_action not in ('mute', 'unmute', 'kick') then raise exception 'unknown_action: %', p_action using errcode = 'P0001'; end if;
  select * into v_m from public.meetups where id = p_id for update;
  if not found then raise exception 'meetup_not_found' using errcode = 'P0002'; end if;
  if not public.is_meetup_host(p_id, v_uid) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_user = v_m.host_id then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_row from public.meetup_rsvps where meetup_id = p_id and user_id = p_user for update;
  if not found then raise exception 'not_attending' using errcode = 'P0001'; end if;
  if v_row.role = 'cohost' and v_uid <> v_m.host_id then raise exception 'not_authorized' using errcode = '42501'; end if;

  if p_action = 'mute' then
    update public.meetup_rsvps set muted_at = now() where meetup_id = p_id and user_id = p_user returning * into v_row;
  elsif p_action = 'unmute' then
    update public.meetup_rsvps set muted_at = null where meetup_id = p_id and user_id = p_user returning * into v_row;
  else
    update public.meetup_rsvps set status = 'declined', removed_at = now(), muted_at = null, role = 'attendee'
      where meetup_id = p_id and user_id = p_user returning * into v_row;
    perform public.meetup_promote_waitlist(p_id);
  end if;
  perform public.emit_event(v_uid, 'meetup.moderated', 'meetup', p_id,
    jsonb_build_object('action', p_action, 'user_id', p_user));
  return v_row;
end; $$;
grant execute on function public.moderate_meetup_attendee(uuid, uuid, text) to authenticated;

-- ---------- jobs (07 §6.4; the 0014d pattern, separate dispatcher) ----------
-- meetup_transitions: every scheduled meetup whose start has passed goes live; every live meetup whose end has
-- passed ends. Each in its own sub-transaction so one bad row never blocks the rest. Idempotent by state.
create or replace function public.world_job_meetup_transitions(p_at timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r         record;
  v_started integer := 0;
  v_ended   integer := 0;
  v_errors  integer := 0;
begin
  if not public.mv_is_backend_caller() then raise exception 'not_authorized' using errcode = '42501'; end if;
  for r in select id from public.meetups where status = 'scheduled' and starts_at <= p_at order by starts_at loop
    begin
      perform public.transition_meetup(r.id, 'start');
      v_started := v_started + 1;
    exception when others then v_errors := v_errors + 1;
    end;
  end loop;
  for r in select id from public.meetups where status = 'live' and ends_at <= p_at order by ends_at loop
    begin
      perform public.transition_meetup(r.id, 'end');
      v_ended := v_ended + 1;
    exception when others then v_errors := v_errors + 1;
    end;
  end loop;
  return jsonb_build_object('started', v_started, 'ended', v_ended, 'errors', v_errors);
end; $$;
revoke execute on function public.world_job_meetup_transitions(timestamptz) from public, anon, authenticated;
grant execute on function public.world_job_meetup_transitions(timestamptz) to service_role;

-- meetup_reminders: T-24 h and T-1 h (07 §2.3). Horizon '24h' fires once the start is within 24 h (and still
-- more than 1 h away — a meetup created 90 min before start only gets the '1h' one); horizon '1h' fires once
-- the start is within the hour. One `meetup.reminder` event per (meetup, horizon) is the idempotency record,
-- then one `meetup_reminder` notification for the host and every attendee going. In-app only: the repo has
-- no transactional-mail path yet (Resend is the auth SMTP only, D-037/D-038) — the email arm waits for one.
create or replace function public.world_job_meetup_reminders(p_at timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m          record;
  r          record;
  v_horizon  text;
  v_events   integer := 0;
  v_notified integer := 0;
begin
  if not public.mv_is_backend_caller() then raise exception 'not_authorized' using errcode = '42501'; end if;
  for m in
    select id, host_id, title, starts_at from public.meetups
    where status = 'scheduled' and starts_at > p_at and starts_at <= p_at + interval '24 hours'
    order by starts_at
  loop
    v_horizon := case when m.starts_at <= p_at + interval '1 hour' then '1h' else '24h' end;
    if exists (
      select 1 from public.domain_events
      where type = 'meetup.reminder' and entity = 'meetup' and entity_id = m.id and payload ->> 'horizon' = v_horizon
    ) then continue; end if;
    perform public.emit_event(null, 'meetup.reminder', 'meetup', m.id,
      jsonb_build_object('horizon', v_horizon, 'starts_at', m.starts_at, 'host_id', m.host_id));
    v_events := v_events + 1;
    for r in
      select m.host_id as user_id
      union
      select user_id from public.meetup_rsvps
      where meetup_id = m.id and removed_at is null and status in ('going', 'checked_in')
    loop
      insert into public.notifications (user_id, type, payload)
        values (r.user_id, 'meetup_reminder', jsonb_build_object(
          'meetup_id', m.id, 'title', m.title, 'starts_at', m.starts_at, 'horizon', v_horizon));
      v_notified := v_notified + 1;
    end loop;
  end loop;
  return jsonb_build_object('reminders', v_events, 'notified', v_notified);
end; $$;
revoke execute on function public.world_job_meetup_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.world_job_meetup_reminders(timestamptz) to service_role;

-- run_meetup_jobs: same contract as run_world_job (0014d) — service role or a direct no-JWT session (pg_cron,
-- psql), presents the service role to the inner functions, one job_runs row per job, each job in its own
-- sub-transaction. A separate dispatcher on purpose: run_world_job's job list is a constant inside its body,
-- and both this sprint and S9's H1 jobs would otherwise have to redefine the same function.
create or replace function public.run_meetup_jobs(
  p_job    text default 'all',
  p_at     timestamptz default now(),
  p_source text default null
)
returns setof public.job_runs
language plpgsql security definer set search_path = public as $$
declare
  c_jobs   constant text[] := array['meetup_transitions', 'meetup_reminders'];
  v_jobs   text[];
  v_job    text;
  v_run    public.job_runs;
  v_result jsonb;
  v_claims text := current_setting('request.jwt.claims', true);
  v_direct boolean;
  v_source text;
begin
  v_direct := coalesce(nullif(v_claims, ''), '') = '' and coalesce(auth.role(), '') = '';
  if not (public.mv_is_backend_caller() or v_direct) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_job is null or (p_job <> 'all' and not (p_job = any (c_jobs))) then
    raise exception 'unknown_job' using errcode = 'P0001';
  end if;
  v_jobs := case when p_job = 'all' then c_jobs else array[p_job] end;
  v_source := coalesce(p_source, case when public.mv_is_backend_caller() then 'edge' else 'cron' end);
  if v_source not in ('cron', 'edge', 'manual') then raise exception 'invalid_source' using errcode = 'P0001'; end if;

  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  foreach v_job in array v_jobs loop
    insert into public.job_runs (job, triggered_by, run_at) values (v_job, v_source, coalesce(p_at, now()))
      returning * into v_run;
    begin
      if    v_job = 'meetup_transitions' then v_result := public.world_job_meetup_transitions(coalesce(p_at, now()));
      elsif v_job = 'meetup_reminders'   then v_result := public.world_job_meetup_reminders(coalesce(p_at, now()));
      end if;
      update public.job_runs
        set status = 'ok', result = coalesce(v_result, '{}'::jsonb), finished_at = clock_timestamp()
        where id = v_run.id returning * into v_run;
    exception when others then
      update public.job_runs
        set status = 'error', error = left(sqlstate || ': ' || sqlerrm, 2000), finished_at = clock_timestamp()
        where id = v_run.id returning * into v_run;
    end;
    return next v_run;
  end loop;

  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  return;
end; $$;
revoke execute on function public.run_meetup_jobs(text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.run_meetup_jobs(text, timestamptz, text) to service_role;

-- pg_cron: one tick every 5 minutes (transitions + reminders). Guarded exactly like 0014d; its own name
-- prefix (`meetups_`) so 0014d's `world\_%` re-scheduling block and this one never unschedule each other.
do $cron$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron unavailable here (%): meetup schedule skipped — the Edge Function `jobs` is the fallback', sqlerrm;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname like 'meetups\_%';
    perform cron.schedule('meetups_tick', '*/5 * * * *', $j$ select public.run_meetup_jobs('all') $j$);
  end if;
end $cron$;

-- ---------- Realtime: the room follows status and showcase changes live (deal_messages is already published) ----------
do $rt$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meetups') then
      alter publication supabase_realtime add table public.meetups;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meetup_showcase') then
      alter publication supabase_realtime add table public.meetup_showcase;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meetup_rsvps') then
      alter publication supabase_realtime add table public.meetup_rsvps;
    end if;
  end if;
end $rt$;

notify pgrst, 'reload schema';
