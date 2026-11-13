-- 0015b_world_best_in_show_clubs — MV-W07-01…05 (F-22 clubs, F-23 best-in-show / photo wall / rewards,
-- F-28 hosting rules), 07 §2.2 / §2.3 / §3.2 / §9, D-021 (state only through RPCs), D-069 (closed loop),
-- D-071 (server authority), D-009 (events), D-077 (`world_meetups` / `world_clubs` stay OFF — ships dark).
-- Builds on 0015 clubs_meetups (20261108172637): no table from that file is recreated.
--
-- What lands here:
--   meetup_votes + vote_best_in_show()   one ballot per room member, changeable while the meetup is live, frozen
--                                        the moment it ends (RPC + trigger); the winner is stamped on the meetup
--   meetup_rsvps.room_*                  attendance clock: meetup_room_ping() accrues seconds on the SERVER clock;
--                                        10 minutes in the live room = attended (`meetup.checked_in`)
--   world_meetup_reward_consumer         domain_events consumer on `meetup.ended` → earn_tokens: earn_attend +3
--                                        (2/day) per attended collector, earn_host +10 (2/week) when ≥ 5 attended
--   photo wall                           media.kind `meetup_photo` (entity_id = meetup): members upload while live or
--                                        within 24 h of the end, ≤ 6 each; read follows meetup visibility
--   reports.target_user_id + report_target_user()   who a report is about (incl. new targets `meetup`, `club`)
--   world_host_suspensions, world_host_ineligible_reason(), admin_set_host_suspension()
--                                        host / club-owner eligibility: F-13 level ≥ 2, no upheld report in 90 d;
--                                        two upheld reports → automatic suspension (event + notification), appeal note
--   club RPCs                            create_club, update_club, join_club, leave_club, invite_to_club,
--                                        decide_club_application, set_club_member_role, moderate_club_member,
--                                        club_feed, club_member_counts (clubs / club_members stay RPC-written)
--   club meetups                         create_meetup keeps club_id for club staff (any visibility);
--                                        club_night_templates + set_club_night / stop_club_night +
--                                        world_job_club_nights (spawns DRAFT instances — the fee is still charged
--                                        to the host on `schedule`, never by a job) in run_meetup_jobs
--
-- PLACEHOLDER numbers (07 §3.2, same status as D-064): attend +3 (2/day), host +10 at ≥ 5 attended (2/week),
-- attendance threshold 10 min, 6 photos per attendee, 3 clubs owned per collector, 500 members per club.

-- ---------- enums (additive, D-006). Only used inside plpgsql bodies / via ::text in this file ----------
alter type public.notification_type add value if not exists 'club_invite';
alter type public.notification_type add value if not exists 'club_approved';
alter type public.notification_type add value if not exists 'club_night_ready';
alter type public.notification_type add value if not exists 'hosting_suspended';
alter type public.media_kind add value if not exists 'meetup_photo';

-- =====================================================================================
-- 1. Reports know who they are about (F-28: eligibility reads upheld reports)
-- =====================================================================================
alter table public.reports
  add column if not exists target_user_id uuid references public.profiles(id) on delete set null;
create index if not exists reports_target_user_idx
  on public.reports (target_user_id, resolved_at desc) where target_user_id is not null;

-- The person a report is about. listing → seller, user / garage → that user, guestbook → the line's
-- author, meetup → the host, club → the owner. NULL for anything else or an id that is not a uuid.
create or replace function public.report_target_user(p_target_type text, p_target_id text)
returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  v_id   uuid;
  v_user uuid;
begin
  if p_target_id is null
     or p_target_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  v_id := p_target_id::uuid;
  if p_target_type = 'listing' then
    select seller_id into v_user from public.marketplace_listings where id = v_id;
  elsif p_target_type in ('user', 'garage') then
    select id into v_user from public.profiles where id = v_id;
  elsif p_target_type = 'guestbook' then
    select author_id into v_user from public.world_guestbook where id = v_id;
  elsif p_target_type = 'meetup' then
    select host_id into v_user from public.meetups where id = v_id;
  elsif p_target_type = 'club' then
    select owner_id into v_user from public.clubs where id = v_id;
  end if;
  return v_user;
end; $$;
revoke execute on function public.report_target_user(text, text) from public, anon, authenticated;

-- Backfill: every report already resolved or open gets its subject (no behaviour change for H1).
update public.reports r
  set target_user_id = public.report_target_user(r.target_type, r.target_id)
  where r.target_user_id is null;

-- =====================================================================================
-- 2. Host eligibility + suspension (07 §9, F-28)
-- =====================================================================================
create table public.world_host_suspensions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  reason       text not null check (reason in ('upheld_reports', 'admin')),
  note         text check (note is null or char_length(note) <= 1000),
  suspended_by uuid references public.profiles(id) on delete set null,
  suspended_at timestamptz not null default now(),
  lifted_at    timestamptz,
  lifted_by    uuid references public.profiles(id) on delete set null,
  appeal_note  text check (appeal_note is null or char_length(appeal_note) <= 1000)
);
create unique index world_host_suspensions_active_idx
  on public.world_host_suspensions (user_id) where lifted_at is null;
create index world_host_suspensions_time_idx on public.world_host_suspensions (suspended_at desc);
alter table public.world_host_suspensions enable row level security;
create policy "Collectors read their own hosting suspension" on public.world_host_suspensions for select
  using (user_id = auth.uid() or public.is_admin());
grant select on public.world_host_suspensions to authenticated;
-- No write policies: resolve_report() and admin_set_host_suspension() are the writers.

-- NULL = may host a meetup / own a club. Otherwise the reason, which is also the exception the RPCs raise:
--   hosting_suspended   an active suspension row, or the account itself is suspended
--   host_recent_report  an upheld report (status reviewed) about them in the last 90 days
--   host_level_too_low  F-13 level < 2 ("Collector")
-- Answers only about the caller unless an admin / the backend asks (it would leak report outcomes).
create or replace function public.world_host_ineligible_reason(p_user uuid default auth.uid())
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_level     integer;
  v_suspended timestamptz;
begin
  if p_user is null then return 'not_authorized'; end if;
  if p_user is distinct from auth.uid() and not (public.is_admin() or public.mv_is_backend_caller()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select level, suspended_until into v_level, v_suspended
    from public.profiles where id = p_user and deleted_at is null;
  if not found then return 'not_authorized'; end if;
  if exists (select 1 from public.world_host_suspensions where user_id = p_user and lifted_at is null)
     or (v_suspended is not null and v_suspended > now()) then
    return 'hosting_suspended';
  end if;
  if exists (
    select 1 from public.reports
    where target_user_id = p_user and status = 'reviewed' and resolved_at > now() - interval '90 days'
  ) then
    return 'host_recent_report';
  end if;
  if coalesce(v_level, 0) < 2 then return 'host_level_too_low'; end if;
  return null;
end; $$;
grant execute on function public.world_host_ineligible_reason(uuid) to authenticated, service_role;

-- Two upheld reports (ever) and no active suspension → suspend. Called by resolve_report() right after a
-- report is upheld; after an admin lifts a suspension the next upheld report suspends again. The
-- notification is sent only to collectors the World is open for (dark means dark, D-028).
create or replace function public.world_apply_host_suspension(p_user uuid, p_report uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_upheld integer;
begin
  if p_user is null then return false; end if;
  select count(*) into v_upheld from public.reports where target_user_id = p_user and status = 'reviewed';
  if v_upheld < 2 then return false; end if;
  if exists (select 1 from public.world_host_suspensions where user_id = p_user and lifted_at is null) then
    return false;
  end if;
  insert into public.world_host_suspensions (user_id, reason, suspended_by)
    values (p_user, 'upheld_reports', auth.uid());
  perform public.emit_event(auth.uid(), 'world.host_suspended', 'profile', p_user,
    jsonb_build_object('reason', 'upheld_reports', 'report_id', p_report, 'upheld', v_upheld));
  if public.mv_flag_active('world_meetups', p_user) or public.mv_flag_active('world_clubs', p_user) then
    insert into public.notifications (user_id, type, payload)
      values (p_user, 'hosting_suspended', jsonb_build_object('reason', 'upheld_reports'));
  end if;
  return true;
end; $$;
revoke execute on function public.world_apply_host_suspension(uuid, uuid) from public, anon, authenticated;

-- Admin: suspend / lift / record an appeal note (07 §11 "appeal path"). `lift` stores the note as the
-- appeal outcome; `note` only edits the appeal note of the active suspension.
create or replace function public.admin_set_host_suspension(p_user uuid, p_action text, p_note text default null)
returns public.world_host_suspensions
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.world_host_suspensions;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_action not in ('suspend', 'lift', 'note') then raise exception 'invalid_action' using errcode = 'P0001'; end if;
  if p_note is not null and char_length(p_note) > 1000 then raise exception 'note_too_long' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  select * into v_row from public.world_host_suspensions where user_id = p_user and lifted_at is null for update;
  if p_action = 'suspend' then
    if found then return v_row; end if;
    insert into public.world_host_suspensions (user_id, reason, note, suspended_by)
      values (p_user, 'admin', nullif(trim(p_note), ''), v_uid) returning * into v_row;
    perform public.emit_event(v_uid, 'world.host_suspended', 'profile', p_user, jsonb_build_object('reason', 'admin'));
    if public.mv_flag_active('world_meetups', p_user) or public.mv_flag_active('world_clubs', p_user) then
      insert into public.notifications (user_id, type, payload)
        values (p_user, 'hosting_suspended', jsonb_build_object('reason', 'admin'));
    end if;
  elsif p_action = 'lift' then
    if not found then raise exception 'not_suspended' using errcode = 'P0001'; end if;
    update public.world_host_suspensions
      set lifted_at = now(), lifted_by = v_uid, appeal_note = coalesce(nullif(trim(p_note), ''), appeal_note)
      where id = v_row.id returning * into v_row;
    perform public.emit_event(v_uid, 'world.host_reinstated', 'profile', p_user, jsonb_build_object('suspension_id', v_row.id));
  else
    if not found then raise exception 'not_suspended' using errcode = 'P0001'; end if;
    update public.world_host_suspensions set appeal_note = nullif(trim(p_note), '')
      where id = v_row.id returning * into v_row;
    perform public.emit_event(v_uid, 'world.host_appeal_noted', 'profile', p_user, jsonb_build_object('suspension_id', v_row.id));
  end if;
  return v_row;
end; $$;
grant execute on function public.admin_set_host_suspension(uuid, text, text) to authenticated;

-- resolve_report: 0013c's body with (a) the subject resolved by report_target_user() — so `meetup` and
-- `club` reports can warn / suspend the host / owner, (b) the subject stored on the row, (c) the hosting
-- suspension check after an upheld report. Signature and every existing action unchanged (D-006).
create or replace function public.resolve_report(
  p_report_id uuid,
  p_action text,
  p_resolution_note text default null
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_report public.reports;
  v_listing public.marketplace_listings;
  v_entry public.world_guestbook;
  v_target_user uuid;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_action not in ('dismiss', 'remove_listing', 'warn', 'suspend', 'hide_guestbook') then
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;

  select * into v_report from public.reports where id = p_report_id and status = 'open';
  if not found then raise exception 'report_not_found_or_resolved' using errcode = 'P0002'; end if;

  v_target_user := public.report_target_user(v_report.target_type, v_report.target_id);
  if v_report.target_type = 'listing' and v_report.target_id is not null then
    select * into v_listing from public.marketplace_listings where id = v_report.target_id::uuid;
  elsif v_report.target_type = 'guestbook' and v_report.target_id is not null then
    select * into v_entry from public.world_guestbook where id = v_report.target_id::uuid;
  end if;

  if p_action = 'remove_listing' then
    if v_listing.id is null then raise exception 'listing_not_found' using errcode = 'P0002'; end if;
    update public.marketplace_listings set status = 'removed' where id = v_listing.id;
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (v_uid, 'listing.removed', 'listing', v_listing.id, jsonb_build_object('reason', 'admin_moderation', 'report_id', p_report_id));
  elsif p_action = 'hide_guestbook' then
    if v_entry.id is null then raise exception 'entry_not_found' using errcode = 'P0002'; end if;
    -- same RPC the host uses (admin is allowed there), so world.guestbook_hidden is emitted once
    perform public.hide_world_guestbook(v_entry.id, true);
  elsif p_action = 'warn' then
    if v_target_user is null then raise exception 'no_target_user' using errcode = 'P0001'; end if;
    insert into public.notifications (user_id, type, payload)
      values (v_target_user, 'system', jsonb_build_object('message', coalesce(p_resolution_note, 'You received a warning from the Tiny Torque team.')));
  elsif p_action = 'suspend' then
    if v_target_user is null then raise exception 'no_target_user' using errcode = 'P0001'; end if;
    update public.profiles set suspended_until = now() + interval '7 days' where id = v_target_user;
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (v_uid, 'user.suspended', 'profile', v_target_user, jsonb_build_object('report_id', p_report_id, 'days', 7));
  end if;

  update public.reports set
    status = (case when p_action = 'dismiss' then 'dismissed' else 'reviewed' end)::public.report_status,
    resolved_by = v_uid,
    resolved_at = now(),
    resolution_note = p_resolution_note,
    target_user_id = v_target_user
    where id = p_report_id
    returning * into v_report;

  insert into public.domain_events (actor_id, type, entity, entity_id, payload)
    values (v_uid, 'report.resolved', 'report', p_report_id, jsonb_build_object('action', p_action));

  if p_action <> 'dismiss' and v_target_user is not null then
    perform public.world_apply_host_suspension(v_target_user, p_report_id);
  end if;

  return v_report;
end; $$;

-- =====================================================================================
-- 3. Best-in-show (07 §2.3: "one vote per attendee, result frozen at end")
-- =====================================================================================
alter table public.meetups
  add column best_in_show_id    uuid references public.meetup_showcase(id) on delete set null,
  add column best_in_show_votes integer check (best_in_show_votes is null or best_in_show_votes > 0);
-- Neither column is in 0015's column-level UPDATE grant, so only transition_meetup() can write them.

create table public.meetup_votes (
  meetup_id   uuid not null references public.meetups(id) on delete cascade,
  voter_id    uuid not null references public.profiles(id) on delete cascade,
  showcase_id uuid not null references public.meetup_showcase(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (meetup_id, voter_id)
);
create index meetup_votes_showcase_idx on public.meetup_votes (showcase_id);
create trigger set_updated_at before update on public.meetup_votes
  for each row execute function public.set_updated_at();
alter table public.meetup_votes enable row level security;
-- A ballot is the voter's own business; the tally is meetup_showcase.votes (public with the meetup).
create policy "Voters read their own ballot" on public.meetup_votes for select
  using (voter_id = auth.uid() or public.is_admin());
grant select on public.meetup_votes to authenticated;
-- No write policies: vote_best_in_show() is the only writer.

-- Belt and braces behind the RPC: a ballot or a tally can only move while the meetup is live. Deletes are
-- not guarded (cascades from a purged account / removed car must still work; nothing grants delete).
create or replace function public.meetup_votes_freeze()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_status public.meetup_status;
begin
  select status into v_status from public.meetups where id = new.meetup_id;
  if v_status is distinct from 'live' then raise exception 'voting_closed' using errcode = 'P0001'; end if;
  return new;
end; $$;
create trigger meetup_votes_freeze before insert or update on public.meetup_votes
  for each row execute function public.meetup_votes_freeze();

create or replace function public.meetup_showcase_votes_freeze()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_status public.meetup_status;
begin
  if new.votes is not distinct from old.votes then return new; end if;
  select status into v_status from public.meetups where id = new.meetup_id;
  if v_status is distinct from 'live' then raise exception 'voting_closed' using errcode = 'P0001'; end if;
  return new;
end; $$;
create trigger meetup_showcase_votes_freeze before update on public.meetup_showcase
  for each row execute function public.meetup_showcase_votes_freeze();

-- One ballot per room member (host and co-hosts are in the room, so they vote too); it can be moved while
-- the meetup is live; never for your own car. The tally is RECOUNTED from the ballots, never incremented.
create or replace function public.vote_best_in_show(p_id uuid, p_showcase_id uuid)
returns public.meetup_showcase
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_m     public.meetups;
  v_entry public.meetup_showcase;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_m from public.meetups where id = p_id for update;
  if not found or not public.meetup_visible(p_id, v_uid) then raise exception 'meetup_not_found' using errcode = 'P0002'; end if;
  if v_m.status <> 'live' then raise exception 'voting_closed' using errcode = 'P0001'; end if;
  if not public.meetup_room_member(p_id, v_uid) then raise exception 'not_attending' using errcode = 'P0001'; end if;
  select * into v_entry from public.meetup_showcase where id = p_showcase_id and meetup_id = p_id;
  if not found then raise exception 'entry_not_found' using errcode = 'P0002'; end if;
  if v_entry.user_id = v_uid then raise exception 'own_entry' using errcode = 'P0001'; end if;

  insert into public.meetup_votes (meetup_id, voter_id, showcase_id) values (p_id, v_uid, p_showcase_id)
    on conflict (meetup_id, voter_id) do update set showcase_id = excluded.showcase_id;
  update public.meetup_showcase s
    set votes = (select count(*) from public.meetup_votes v where v.showcase_id = s.id)
    where s.meetup_id = p_id
      and s.votes is distinct from (select count(*) from public.meetup_votes v where v.showcase_id = s.id);

  perform public.emit_event(v_uid, 'meetup.voted', 'meetup', p_id,
    jsonb_build_object('showcase_id', p_showcase_id, 'host_id', v_m.host_id));
  select * into v_entry from public.meetup_showcase where id = p_showcase_id;
  return v_entry;
end; $$;
grant execute on function public.vote_best_in_show(uuid, uuid) to authenticated;

-- =====================================================================================
-- 4. Attendance clock (W07-01: "attendance = joined room ≥ 10 min")
-- =====================================================================================
alter table public.meetup_rsvps
  add column room_joined_at timestamptz,
  add column room_seen_at   timestamptz,
  add column room_seconds   integer not null default 0 check (room_seconds >= 0),
  add column attended_at    timestamptz;

-- The room calls this on open and once a minute. Time accrues on the server clock: each ping adds the
-- gap since the previous one, capped at 120 s, so a closed tab stops the clock and a client cannot
-- assert minutes. 600 s → attended_at + `meetup.checked_in` (once). Returns whether the caller has
-- attended. The host has no rsvp row and no attend reward — false.
create or replace function public.meetup_room_ping(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_m    public.meetups;
  v_row  public.meetup_rsvps;
  v_add  integer;
  v_was  boolean;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_m from public.meetups where id = p_id;
  if not found or v_m.status <> 'live' then return false; end if;
  select * into v_row from public.meetup_rsvps
    where meetup_id = p_id and user_id = v_uid and removed_at is null and status in ('going', 'checked_in')
    for update;
  if not found then return false; end if;
  v_was := v_row.attended_at is not null;

  v_add := case when v_row.room_seen_at is null then 0
                else least(greatest(floor(extract(epoch from (now() - v_row.room_seen_at)))::integer, 0), 120) end;
  update public.meetup_rsvps
    set room_joined_at = coalesce(room_joined_at, now()),
        room_seen_at   = now(),
        room_seconds   = room_seconds + v_add,
        attended_at    = case when attended_at is null and room_seconds + v_add >= 600 then now() else attended_at end
    where meetup_id = p_id and user_id = v_uid
    returning * into v_row;
  if v_row.attended_at is not null and not v_was then
    perform public.emit_event(v_uid, 'meetup.checked_in', 'meetup', p_id,
      jsonb_build_object('kind', 'virtual', 'host_id', v_m.host_id, 'seconds', v_row.room_seconds));
  end if;
  return v_row.attended_at is not null;
end; $$;
grant execute on function public.meetup_room_ping(uuid) to authenticated;

-- =====================================================================================
-- 5. Attend / host rewards through the earn engine (07 §3.2, §6.2 "consumer on domain_events")
-- =====================================================================================
-- On `meetup.ended`: every collector who attended (not the host) gets earn_attend +3, at most 2 per UTC day;
-- the host gets earn_host +10 when ≥ 5 collectors attended, at most 2 per UTC week. Each payout is gated by
-- `world_earn` for the RECIPIENT, idempotent by key, and still subject to earn_tokens' daily ceiling and
-- earn freeze. A failure is logged, never raised: an earn hiccup must not undo the end of a meetup.
create or replace function public.world_meetup_reward_consumer()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_m        public.meetups;
  v_attended integer := 0;
  v_n        integer;
  r          record;
begin
  if new.type <> 'meetup.ended' or new.entity_id is null then return new; end if;
  select * into v_m from public.meetups where id = new.entity_id;
  if not found then return new; end if;

  begin
    perform set_config('mv.earn_rpc', 'on', true);
    for r in
      select user_id from public.meetup_rsvps
      where meetup_id = v_m.id and removed_at is null and attended_at is not null and user_id <> v_m.host_id
      order by attended_at, user_id
    loop
      v_attended := v_attended + 1;
      continue when not public.mv_flag_active('world_earn', r.user_id);
      select count(*) into v_n from public.token_ledger
        where user_id = r.user_id and reason = 'earn_attend'
          and created_at >= public.mv_utc_day_start(public.mv_utc_day(now()));
      continue when v_n >= 2;
      perform public.earn_tokens(r.user_id, 'earn_attend', 3, 'attend:' || v_m.id::text || ':' || r.user_id::text);
    end loop;

    if v_attended >= 5 and public.mv_flag_active('world_earn', v_m.host_id) then
      select count(*) into v_n from public.token_ledger
        where user_id = v_m.host_id and reason = 'earn_host'
          and created_at >= public.mv_utc_day_start(public.quest_period_start('weekly', now()));
      if v_n < 2 then
        perform public.earn_tokens(v_m.host_id, 'earn_host', 10, 'host:' || v_m.id::text);
      end if;
    end if;
    perform set_config('mv.earn_rpc', 'off', true);
  exception when others then
    perform set_config('mv.earn_rpc', 'off', true);
    raise warning 'world_meetup_reward_consumer(%): % %', new.entity_id, sqlstate, sqlerrm;
  end;
  return new;
end; $$;
revoke execute on function public.world_meetup_reward_consumer() from public, anon, authenticated;

create trigger world_meetup_reward_consumer
  after insert on public.domain_events
  for each row when (new.type = 'meetup.ended')
  execute function public.world_meetup_reward_consumer();

-- =====================================================================================
-- 6. Photo wall: media rows of kind `meetup_photo` (07 §6.5, D-010)
-- =====================================================================================
-- "Owners manage their media" (0003) lets anyone insert a row they own, so the rule for this kind is a
-- guard: the uploader is in the room, the meetup is live or ended < 24 h ago, ≤ 6 photos each, and a
-- row can never be turned into (or out of) a wall photo, moved to another meetup, or put back on the
-- wall once it was taken down.
create or replace function public.media_meetup_photo_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_m public.meetups;
  v_n integer;
begin
  if tg_op = 'UPDATE' then
    if (new.kind::text = 'meetup_photo') <> (old.kind::text = 'meetup_photo')
       or (new.kind::text = 'meetup_photo'
           and (new.entity_id is distinct from old.entity_id or new.owner_id <> old.owner_id
                or new.path <> old.path or new.bucket <> old.bucket
                or (old.status::text = 'removed' and new.status::text <> 'removed'))) then
      raise exception 'rpc_only_column' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.kind::text <> 'meetup_photo' then return new; end if;
  if new.bucket <> 'item-media' or new.entity_id is null then raise exception 'invalid_photo' using errcode = 'P0001'; end if;
  select * into v_m from public.meetups where id = new.entity_id;
  if not found or not public.meetup_room_member(v_m.id, new.owner_id) then
    raise exception 'not_attending' using errcode = 'P0001';
  end if;
  if not (v_m.status = 'live' or (v_m.status = 'ended' and v_m.ended_at > now() - interval '24 hours')) then
    raise exception 'photo_wall_closed' using errcode = 'P0001';
  end if;
  select count(*) into v_n from public.media
    where kind::text = 'meetup_photo' and entity_id = new.entity_id and owner_id = new.owner_id
      and status::text <> 'removed';
  if v_n >= 6 then raise exception 'photo_limit' using errcode = 'P0001'; end if;
  return new;
end; $$;
create trigger media_meetup_photo_guard before insert or update on public.media
  for each row execute function public.media_meetup_photo_guard();

create policy "Meetup photo wall follows meetup visibility" on public.media for select
  using (kind::text = 'meetup_photo' and status::text = 'ready' and public.meetup_visible(entity_id, auth.uid()));

create policy "Meetup photo wall objects are readable" on storage.objects for select
  using (
    bucket_id = 'item-media'
    and exists (
      select 1 from public.media m
      where m.bucket = 'item-media' and m.path = storage.objects.name
        and m.kind::text = 'meetup_photo' and m.status::text = 'ready'
        and public.meetup_visible(m.entity_id, auth.uid())
    )
  );

-- Take a photo off the wall: its owner, the host / a co-host, or an admin. The row stays (status removed)
-- so the storage purge job frees the object; the wall only lists `ready` rows.
create or replace function public.remove_meetup_photo(p_media_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.media;
  v_by  text;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_row from public.media where id = p_media_id and kind::text = 'meetup_photo' for update;
  if not found then raise exception 'photo_not_found' using errcode = 'P0002'; end if;
  v_by := case when v_row.owner_id = v_uid then 'owner'
               when public.is_meetup_host(v_row.entity_id, v_uid) then 'host'
               when public.is_admin() then 'admin' end;
  if v_by is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if v_row.status::text = 'removed' then return; end if;
  update public.media set status = 'removed' where id = p_media_id;
  perform public.emit_event(v_uid, 'meetup.photo_removed', 'meetup', v_row.entity_id,
    jsonb_build_object('media_id', p_media_id, 'owner_id', v_row.owner_id, 'by', v_by));
end; $$;
grant execute on function public.remove_meetup_photo(uuid) to authenticated;

-- =====================================================================================
-- 7. Clubs: helpers, read rules, RPC writers (F-22)
-- =====================================================================================
-- pending + invited_by set = an invitation waiting for the collector; pending + invited_by NULL = an
-- application waiting for the club's staff.
alter table public.club_members
  add column invited_by uuid references public.profiles(id) on delete set null;

-- The caller's role in a club while their membership is active; NULL otherwise.
create or replace function public.club_role(p_club uuid, p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select cm.role::text from public.club_members cm
  where cm.club_id = p_club and cm.user_id = p_user and cm.status = 'active';
$$;
grant execute on function public.club_role(uuid, uuid) to anon, authenticated;

create or replace function public.is_club_staff(p_club uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.club_role(p_club, p_user) in ('owner', 'admin'), false);
$$;
grant execute on function public.is_club_staff(uuid, uuid) to anon, authenticated;

-- An open club's active roster is public to signed-in collectors (the clubhouse shows members' cars);
-- apply / invite clubs keep 0015's rule (members, the member themself, admins).
create policy "Open club rosters are readable" on public.club_members for select
  using (
    status = 'active'
    and exists (select 1 from public.clubs c where c.id = club_id and c.join_mode = 'open')
  );

-- Member counts for a list of clubs (a closed club's roster is not readable, its size is).
create or replace function public.club_member_counts(p_clubs uuid[])
returns table (club_id uuid, members integer)
language sql stable security definer set search_path = public as $$
  select cm.club_id, count(*)::integer
  from public.club_members cm
  where cm.club_id = any (p_clubs) and cm.status = 'active'
  group by cm.club_id;
$$;
grant execute on function public.club_member_counts(uuid[]) to authenticated;

-- The club feed = the club's own events, newest first. Open club: any signed-in collector. Otherwise
-- active members and admins only (F-22 AC "only members read a non-open club's feed").
create or replace function public.club_feed(p_club uuid, p_limit integer default 20)
returns table (event_id bigint, type text, actor_id uuid, payload jsonb, occurred_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_mode public.club_join_mode;
begin
  select join_mode into v_mode from public.clubs where id = p_club;
  if not found or v_uid is null then return; end if;
  if not (v_mode = 'open' or public.is_club_member(p_club, v_uid) or public.is_admin()) then return; end if;
  return query
    select e.id, e.type, e.actor_id, e.payload, e.occurred_at
    from public.domain_events e
    where e.entity = 'club' and e.entity_id = p_club
      and e.type in ('club.created', 'club.joined', 'club.left', 'club.role_changed', 'club.updated',
                     'club.meetup_scheduled', 'club.night_set')
    order by e.occurred_at desc, e.id desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50);
end; $$;
grant execute on function public.club_feed(uuid, integer) to authenticated;

-- ---------- create_club ----------
-- Owner eligibility = host eligibility (F-22 "follow F-28's rules"). ≤ 3 clubs owned. The slug is the
-- club's address (citext unique, ^[a-z0-9_]{3,24}$).
create or replace function public.create_club(
  p_slug        text,
  p_name        text,
  p_join_mode   public.club_join_mode default 'open',
  p_description text default null,
  p_country     text default null
)
returns public.clubs
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_reason text;
  v_slug   text := lower(trim(coalesce(p_slug, '')));
  v_row    public.clubs;
  v_n      integer;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  v_reason := public.world_host_ineligible_reason(v_uid);
  if v_reason is not null then raise exception '%', v_reason using errcode = 'P0001'; end if;
  if v_slug !~ '^[a-z0-9_]{3,24}$' then raise exception 'invalid_slug' using errcode = 'P0001'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 60 then raise exception 'invalid_name' using errcode = 'P0001'; end if;
  select count(*) into v_n from public.clubs where owner_id = v_uid;
  if v_n >= 3 then raise exception 'club_limit' using errcode = 'P0001'; end if;
  if exists (select 1 from public.clubs where slug = v_slug) then raise exception 'slug_taken' using errcode = 'P0001'; end if;

  insert into public.clubs (slug, name, owner_id, join_mode, description, country_code)
    values (v_slug, trim(p_name), v_uid, coalesce(p_join_mode, 'open'), nullif(trim(p_description), ''),
            nullif(upper(trim(p_country)), ''))
    returning * into v_row;
  insert into public.club_members (club_id, user_id, role, status) values (v_row.id, v_uid, 'owner', 'active');
  perform public.emit_event(v_uid, 'club.created', 'club', v_row.id,
    jsonb_build_object('slug', v_row.slug, 'name', v_row.name, 'join_mode', v_row.join_mode));
  return v_row;
exception when unique_violation then
  raise exception 'slug_taken' using errcode = 'P0001';
end; $$;
grant execute on function public.create_club(text, text, public.club_join_mode, text, text) to authenticated;

-- ---------- update_club: owner / admins edit name, join mode, description, country ----------
create or replace function public.update_club(
  p_club        uuid,
  p_name        text,
  p_join_mode   public.club_join_mode,
  p_description text default null,
  p_country     text default null
)
returns public.clubs
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.clubs;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.clubs where id = p_club) then raise exception 'club_not_found' using errcode = 'P0002'; end if;
  if not public.is_club_staff(p_club, v_uid) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 60 then raise exception 'invalid_name' using errcode = 'P0001'; end if;
  update public.clubs
    set name = trim(p_name), join_mode = coalesce(p_join_mode, join_mode),
        description = nullif(trim(p_description), ''), country_code = nullif(upper(trim(p_country)), '')
    where id = p_club returning * into v_row;
  perform public.emit_event(v_uid, 'club.updated', 'club', p_club,
    jsonb_build_object('name', v_row.name, 'join_mode', v_row.join_mode));
  return v_row;
end; $$;
grant execute on function public.update_club(uuid, text, public.club_join_mode, text, text) to authenticated;

-- ---------- join_club: open → member at once; apply → pending application; invite → needs an invitation ----------
-- A banned collector cannot come back (F-22 AC); a block with the owner reads as "no such club".
create or replace function public.join_club(p_club uuid)
returns public.club_members
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_club public.clubs;
  v_row  public.club_members;
  v_n    integer;
  v_invited boolean := false;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_club from public.clubs where id = p_club for update;
  if not found or public.is_blocked(v_uid, v_club.owner_id) then raise exception 'club_not_found' using errcode = 'P0002'; end if;

  select * into v_row from public.club_members where club_id = p_club and user_id = v_uid for update;
  if found then
    if v_row.status = 'banned' then raise exception 'banned_from_club' using errcode = 'P0001'; end if;
    if v_row.status = 'active' or v_row.invited_by is null then return v_row; end if;
    v_invited := true; -- pending invitation → accept
  else
    if v_club.join_mode = 'invite' then raise exception 'invite_required' using errcode = 'P0001'; end if;
    select count(*) into v_n from public.club_members where user_id = v_uid and joined_at > now() - interval '1 hour';
    if v_n >= 20 then raise exception 'club_rate_limit' using errcode = 'P0001'; end if;
  end if;

  select count(*) into v_n from public.club_members where club_id = p_club and status = 'active';
  if v_n >= 500 then raise exception 'club_full' using errcode = 'P0001'; end if;

  if v_invited or v_club.join_mode = 'open' then
    insert into public.club_members (club_id, user_id, role, status) values (p_club, v_uid, 'member', 'active')
      on conflict (club_id, user_id) do update set status = 'active', role = 'member', joined_at = now()
      returning * into v_row;
    perform public.emit_event(v_uid, 'club.joined', 'club', p_club,
      jsonb_build_object('via', case when v_invited then 'invite' else 'open' end));
  else
    insert into public.club_members (club_id, user_id, role, status) values (p_club, v_uid, 'member', 'pending')
      returning * into v_row;
    perform public.emit_event(v_uid, 'club.applied', 'club', p_club, '{}'::jsonb);
  end if;
  return v_row;
end; $$;
grant execute on function public.join_club(uuid) to authenticated;

-- ---------- leave_club: a member leaves, an applicant withdraws, an invitee declines. The owner cannot ----------
create or replace function public.leave_club(p_club uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.club_members;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_row from public.club_members where club_id = p_club and user_id = v_uid for update;
  if not found or v_row.status = 'banned' then raise exception 'not_a_member' using errcode = 'P0001'; end if;
  if v_row.role = 'owner' then raise exception 'owner_cannot_leave' using errcode = 'P0001'; end if;
  delete from public.club_members where club_id = p_club and user_id = v_uid;
  if v_row.status = 'active' then
    perform public.emit_event(v_uid, 'club.left', 'club', p_club, '{}'::jsonb);
  else
    perform public.emit_event(v_uid, 'club.application_withdrawn', 'club', p_club,
      jsonb_build_object('invited', v_row.invited_by is not null));
  end if;
end; $$;
grant execute on function public.leave_club(uuid) to authenticated;

-- ---------- invite_to_club: owner / admins invite by handle (also approves a pending application) ----------
create or replace function public.invite_to_club(p_club uuid, p_handle text)
returns public.club_members
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_club    public.clubs;
  v_invitee uuid;
  v_row     public.club_members;
  v_n       integer;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_club from public.clubs where id = p_club for update;
  if not found then raise exception 'club_not_found' using errcode = 'P0002'; end if;
  if not public.is_club_staff(p_club, v_uid) then raise exception 'not_authorized' using errcode = '42501'; end if;
  select id into v_invitee from public.profiles where handle = lower(trim(p_handle)) and deleted_at is null;
  if v_invitee is null or v_invitee = v_uid or public.is_blocked(v_invitee, v_uid)
     or public.is_blocked(v_invitee, v_club.owner_id) then
    raise exception 'invitee_not_found' using errcode = 'P0002';
  end if;

  select * into v_row from public.club_members where club_id = p_club and user_id = v_invitee for update;
  if found then
    if v_row.status = 'banned' then raise exception 'banned_from_club' using errcode = 'P0001'; end if;
    if v_row.status = 'active' or v_row.invited_by is not null then return v_row; end if;
    -- a pending application: the invite is the approval
    update public.club_members set status = 'active', joined_at = now()
      where club_id = p_club and user_id = v_invitee returning * into v_row;
    perform public.emit_event(v_invitee, 'club.joined', 'club', p_club, jsonb_build_object('via', 'approved', 'by', v_uid));
    insert into public.notifications (user_id, type, payload)
      values (v_invitee, 'club_approved', jsonb_build_object('club_id', v_club.id, 'slug', v_club.slug, 'name', v_club.name));
    return v_row;
  end if;

  select count(*) into v_n from public.club_members where club_id = p_club and status = 'pending' and invited_by is not null;
  if v_n >= 50 then raise exception 'invite_limit' using errcode = 'P0001'; end if;
  insert into public.club_members (club_id, user_id, role, status, invited_by)
    values (p_club, v_invitee, 'member', 'pending', v_uid) returning * into v_row;
  insert into public.notifications (user_id, type, payload)
    values (v_invitee, 'club_invite', jsonb_build_object('club_id', v_club.id, 'slug', v_club.slug, 'name', v_club.name));
  perform public.emit_event(v_uid, 'club.invited', 'club', p_club, jsonb_build_object('invitee_id', v_invitee));
  return v_row;
end; $$;
grant execute on function public.invite_to_club(uuid, text) to authenticated;

-- ---------- decide_club_application: owner / admins approve or decline an application ----------
create or replace function public.decide_club_application(p_club uuid, p_user uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_club public.clubs;
  v_row  public.club_members;
  v_n    integer;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_club from public.clubs where id = p_club for update;
  if not found then raise exception 'club_not_found' using errcode = 'P0002'; end if;
  if not public.is_club_staff(p_club, v_uid) then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_row from public.club_members where club_id = p_club and user_id = p_user for update;
  if not found or v_row.status <> 'pending' or v_row.invited_by is not null then
    raise exception 'no_application' using errcode = 'P0001';
  end if;

  if p_approve then
    select count(*) into v_n from public.club_members where club_id = p_club and status = 'active';
    if v_n >= 500 then raise exception 'club_full' using errcode = 'P0001'; end if;
    update public.club_members set status = 'active', joined_at = now() where club_id = p_club and user_id = p_user;
    perform public.emit_event(p_user, 'club.joined', 'club', p_club, jsonb_build_object('via', 'approved', 'by', v_uid));
    insert into public.notifications (user_id, type, payload)
      values (p_user, 'club_approved', jsonb_build_object('club_id', v_club.id, 'slug', v_club.slug, 'name', v_club.name));
  else
    delete from public.club_members where club_id = p_club and user_id = p_user;
    perform public.emit_event(v_uid, 'club.application_declined', 'club', p_club, jsonb_build_object('user_id', p_user));
  end if;
end; $$;
grant execute on function public.decide_club_application(uuid, uuid, boolean) to authenticated;

-- ---------- set_club_member_role: the owner promotes / demotes, or hands the club over ----------
-- role 'owner' = transfer: the member becomes the owner, the caller an admin, clubs.owner_id follows.
create or replace function public.set_club_member_role(p_club uuid, p_user uuid, p_role public.club_member_role)
returns public.club_members
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_club public.clubs;
  v_row  public.club_members;
  v_from public.club_member_role;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_club from public.clubs where id = p_club for update;
  if not found then raise exception 'club_not_found' using errcode = 'P0002'; end if;
  if v_club.owner_id <> v_uid then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_user = v_uid then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_row from public.club_members where club_id = p_club and user_id = p_user for update;
  if not found or v_row.status <> 'active' then raise exception 'not_a_member' using errcode = 'P0001'; end if;
  v_from := v_row.role;
  if v_from = p_role then return v_row; end if;

  if p_role = 'owner' then
    update public.club_members set role = 'admin' where club_id = p_club and user_id = v_uid;
    update public.clubs set owner_id = p_user where id = p_club;
  end if;
  update public.club_members set role = p_role where club_id = p_club and user_id = p_user returning * into v_row;
  perform public.emit_event(v_uid, 'club.role_changed', 'club', p_club,
    jsonb_build_object('user_id', p_user, 'role', p_role, 'from', v_from));
  return v_row;
end; $$;
grant execute on function public.set_club_member_role(uuid, uuid, public.club_member_role) to authenticated;

-- ---------- moderate_club_member: remove / ban / unban (F-22 AC "owner/admin can remove members") ----------
-- Owner and admins act on members; only the owner acts on an admin; nobody acts on the owner. `ban`
-- keeps the row (status banned) so join_club refuses them; `unban` deletes it — they may join again.
create or replace function public.moderate_club_member(p_club uuid, p_user uuid, p_action text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_club public.clubs;
  v_row  public.club_members;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_action not in ('remove', 'ban', 'unban') then raise exception 'unknown_action: %', p_action using errcode = 'P0001'; end if;
  select * into v_club from public.clubs where id = p_club for update;
  if not found then raise exception 'club_not_found' using errcode = 'P0002'; end if;
  if not public.is_club_staff(p_club, v_uid) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_user = v_club.owner_id or p_user = v_uid then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_row from public.club_members where club_id = p_club and user_id = p_user for update;
  if not found then raise exception 'not_a_member' using errcode = 'P0001'; end if;
  if v_row.role = 'admin' and v_row.status = 'active' and v_club.owner_id <> v_uid then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_action = 'unban' then
    if v_row.status <> 'banned' then raise exception 'not_banned' using errcode = 'P0001'; end if;
    delete from public.club_members where club_id = p_club and user_id = p_user;
  elsif p_action = 'ban' then
    update public.club_members set status = 'banned', role = 'member', invited_by = null
      where club_id = p_club and user_id = p_user;
  else
    if v_row.status = 'banned' then raise exception 'not_a_member' using errcode = 'P0001'; end if;
    delete from public.club_members where club_id = p_club and user_id = p_user;
  end if;
  perform public.emit_event(v_uid, 'club.member_moderated', 'club', p_club,
    jsonb_build_object('user_id', p_user, 'action', p_action));
end; $$;
grant execute on function public.moderate_club_member(uuid, uuid, text) to authenticated;

-- =====================================================================================
-- 8. Club meetups: create_meetup / meetups_guard / transition_meetup redefined in full (D-006)
-- =====================================================================================
-- create_meetup — 0015's body plus: (a) host eligibility (F-28) after the garage-level check,
-- (b) "host as a club": a club id is kept for ANY visibility when the caller is the club's owner or an
-- admin; `club` visibility still needs a club.
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
  v_uid    uuid := auth.uid();
  v_cap    integer;
  v_reason text;
  v_row    public.meetups;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  perform public.ensure_world_garage();
  v_cap := public.meetup_host_cap(v_uid);
  if v_cap <= 0 then raise exception 'host_not_eligible' using errcode = 'P0001'; end if;
  v_reason := public.world_host_ineligible_reason(v_uid);
  if v_reason is not null then raise exception '%', v_reason using errcode = 'P0001'; end if;
  if p_capacity is null or p_capacity > v_cap then raise exception 'capacity_too_high' using errcode = 'P0001'; end if;
  if p_starts_at is null or p_starts_at <= now() then raise exception 'starts_in_past' using errcode = 'P0001'; end if;
  if p_visibility = 'club' and p_club_id is null then raise exception 'not_club_member' using errcode = 'P0001'; end if;
  if p_club_id is not null and not public.is_club_staff(p_club_id, v_uid) then
    raise exception 'not_club_staff' using errcode = 'P0001';
  end if;

  insert into public.meetups (host_id, club_id, garage_user_id, title, theme, description, starts_at, ends_at,
                              capacity, visibility)
    values (v_uid, p_club_id, v_uid,
            trim(p_title), nullif(trim(p_theme), ''), nullif(trim(p_description), ''),
            p_starts_at, p_ends_at, p_capacity, p_visibility)
    returning * into v_row;

  perform public.emit_event(v_uid, 'meetup.created', 'meetup', v_row.id, jsonb_build_object(
    'capacity', v_row.capacity, 'visibility', v_row.visibility, 'starts_at', v_row.starts_at,
    'club_id', v_row.club_id));
  return v_row;
end; $$;

-- meetups_guard — 0015's body plus: a host's direct edit may only point club_id at a club they are
-- staff of (it is in the column-level grant, so the guard is the rule).
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
       or new.garage_user_id is distinct from old.garage_user_id
       or new.best_in_show_id is distinct from old.best_in_show_id
       or new.best_in_show_votes is distinct from old.best_in_show_votes then
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
    if new.club_id is distinct from old.club_id and new.club_id is not null
       and not public.is_club_staff(new.club_id, new.host_id) then
      raise exception 'not_club_staff' using errcode = 'P0001';
    end if;
    if new.visibility = 'club' and not public.is_club_member(new.club_id, new.host_id) then
      raise exception 'not_club_member' using errcode = 'P0001';
    end if;
  end if;
  return new;
end; $$;

-- transition_meetup — 0015's body plus: `schedule` re-checks host eligibility and announces a club meetup
-- on the club feed; `end` stamps the best-in-show winner (most votes; ties go to the entry placed on the
-- table first) and emits `meetup.best_in_show`; `meetup.ended` carries the attended count.
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
  v_attended integer;
  v_refunded boolean := false;
  v_reason   text;
  v_win      public.meetup_showcase;
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
    v_reason := public.world_host_ineligible_reason(v_uid);
    if v_reason is not null then raise exception '%', v_reason using errcode = 'P0001'; end if;
    if v_m.club_id is not null and not public.is_club_staff(v_m.club_id, v_uid) then
      raise exception 'not_club_staff' using errcode = 'P0001';
    end if;
    v_fee := public.meetup_host_fee(v_m.capacity);
    -- spend_tokens raises insufficient_balance itself; nothing below runs then.
    v_grant := public.spend_tokens('spend_meetup_host', v_fee, 'meetup_host', 1, null,
                                   'meetup', v_m.id, 'meetup_host:' || v_m.id::text);
    update public.meetups
      set status = 'scheduled', scheduled_at = now(), fee_paid = v_fee, fee_ledger_id = v_grant.ledger_id
      where id = v_m.id;
    perform public.emit_event(v_uid, 'meetup.scheduled', 'meetup', v_m.id, jsonb_build_object(
      'fee', v_fee, 'capacity', v_m.capacity, 'starts_at', v_m.starts_at, 'ledger_id', v_grant.ledger_id,
      'club_id', v_m.club_id));
    if v_m.club_id is not null then
      perform public.emit_event(v_uid, 'club.meetup_scheduled', 'club', v_m.club_id, jsonb_build_object(
        'meetup_id', v_m.id, 'title', v_m.title, 'starts_at', v_m.starts_at));
    end if;

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
    select count(*) into v_attended from public.meetup_rsvps
      where meetup_id = v_m.id and removed_at is null and attended_at is not null and user_id <> v_m.host_id;
    select * into v_win from public.meetup_showcase
      where meetup_id = v_m.id and votes > 0
      order by votes desc, created_at, id limit 1;
    update public.meetups
      set status = 'ended', ended_at = now(), best_in_show_id = v_win.id, best_in_show_votes = v_win.votes
      where id = v_m.id;
    if v_win.id is not null then
      perform public.emit_event(v_win.user_id, 'meetup.best_in_show', 'meetup', v_m.id, jsonb_build_object(
        'showcase_id', v_win.id, 'item_id', v_win.item_id, 'votes', v_win.votes, 'host_id', v_m.host_id));
    end if;
    perform public.emit_event(coalesce(v_uid, v_m.host_id), 'meetup.ended', 'meetup', v_m.id, jsonb_build_object(
      'host_id', v_m.host_id, 'attendees', v_count, 'attended', v_attended,
      'by', case when v_backend then 'jobs' else 'host' end));

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

-- =====================================================================================
-- 9. Recurring club night (07 §2.3 "a template that spawns instances via the jobs runner")
-- =====================================================================================
create table public.club_night_templates (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references public.clubs(id) on delete cascade,
  host_id          uuid not null references public.profiles(id) on delete cascade,
  title            text not null check (char_length(title) between 3 and 80),
  theme            text check (theme is null or char_length(theme) <= 60),
  cadence          text not null check (cadence in ('weekly', 'monthly')),
  next_starts_at   timestamptz not null,
  duration_minutes integer not null default 120 check (duration_minutes between 30 and 360),
  capacity         integer not null check (capacity between 2 and 500),
  visibility       public.meetup_visibility not null default 'club',
  active           boolean not null default true,
  last_meetup_id   uuid references public.meetups(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger set_updated_at before update on public.club_night_templates
  for each row execute function public.set_updated_at();
create unique index club_night_templates_active_idx on public.club_night_templates (club_id) where active;
create index club_night_templates_due_idx on public.club_night_templates (next_starts_at) where active;
alter table public.club_night_templates enable row level security;
create policy "Club members read the club night" on public.club_night_templates for select
  using (public.is_club_member(club_id, auth.uid()) or public.is_admin());
grant select on public.club_night_templates to authenticated;
-- No write policies: set_club_night / stop_club_night / the job are the writers.

-- One active club night per club; setting a new one replaces it. The caller (owner / admin) is the host of
-- every instance and must be able to host (garage cap + eligibility) — checked now and again per spawn.
create or replace function public.set_club_night(
  p_club          uuid,
  p_title         text,
  p_cadence       text,
  p_first_start   timestamptz,
  p_duration      integer,
  p_capacity      integer,
  p_visibility    public.meetup_visibility default 'club',
  p_theme         text default null
)
returns public.club_night_templates
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_reason text;
  v_row    public.club_night_templates;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.clubs where id = p_club) then raise exception 'club_not_found' using errcode = 'P0002'; end if;
  if not public.is_club_staff(p_club, v_uid) then raise exception 'not_club_staff' using errcode = 'P0001'; end if;
  if p_cadence not in ('weekly', 'monthly') then raise exception 'invalid_cadence' using errcode = 'P0001'; end if;
  if p_first_start is null or p_first_start <= now() then raise exception 'starts_in_past' using errcode = 'P0001'; end if;
  if public.meetup_host_cap(v_uid) <= 0 then raise exception 'host_not_eligible' using errcode = 'P0001'; end if;
  v_reason := public.world_host_ineligible_reason(v_uid);
  if v_reason is not null then raise exception '%', v_reason using errcode = 'P0001'; end if;
  if p_capacity is null or p_capacity > public.meetup_host_cap(v_uid) then raise exception 'capacity_too_high' using errcode = 'P0001'; end if;

  update public.club_night_templates set active = false where club_id = p_club and active;
  insert into public.club_night_templates (club_id, host_id, title, theme, cadence, next_starts_at,
                                           duration_minutes, capacity, visibility)
    values (p_club, v_uid, trim(p_title), nullif(trim(p_theme), ''), p_cadence, p_first_start,
            coalesce(p_duration, 120), p_capacity, coalesce(p_visibility, 'club'))
    returning * into v_row;
  perform public.emit_event(v_uid, 'club.night_set', 'club', p_club, jsonb_build_object(
    'title', v_row.title, 'cadence', v_row.cadence, 'next_starts_at', v_row.next_starts_at));
  return v_row;
end; $$;
grant execute on function public.set_club_night(uuid, text, text, timestamptz, integer, integer, public.meetup_visibility, text)
  to authenticated;

create or replace function public.stop_club_night(p_club uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if not public.is_club_staff(p_club, v_uid) then raise exception 'not_club_staff' using errcode = 'P0001'; end if;
  update public.club_night_templates set active = false where club_id = p_club and active;
  if found then
    perform public.emit_event(v_uid, 'club.night_stopped', 'club', p_club, '{}'::jsonb);
  end if;
end; $$;
grant execute on function public.stop_club_night(uuid) to authenticated;

-- club_nights job: every active template whose next start is within 7 days gets ONE draft meetup for that
-- start, then the template advances by its cadence — the advanced `next_starts_at` is the idempotency
-- record. A draft, not a scheduled meetup: the hosting fee is a spend the host makes (spend_tokens needs
-- the host's session, D-071), so the host gets `club_night_ready` and schedules it. A template whose host
-- is no longer club staff is switched off; a host who cannot host right now (suspended, level, cap) skips
-- that occurrence and keeps the template.
create or replace function public.world_job_club_nights(p_at timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t          public.club_night_templates;
  v_meetup   public.meetups;
  v_cap      integer;
  v_spawned  integer := 0;
  v_skipped  integer := 0;
  v_stopped  integer := 0;
  v_guard    integer;
begin
  if not public.mv_is_backend_caller() then raise exception 'not_authorized' using errcode = '42501'; end if;
  for t in
    select * from public.club_night_templates
    where active and next_starts_at <= p_at + interval '7 days'
    order by next_starts_at
    for update
  loop
    if not public.is_club_staff(t.club_id, t.host_id) then
      update public.club_night_templates set active = false where id = t.id;
      v_stopped := v_stopped + 1;
      continue;
    end if;
    v_guard := 0;
    while t.next_starts_at <= p_at + interval '7 days' and v_guard < 60 loop
      v_guard := v_guard + 1;
      v_cap := public.meetup_host_cap(t.host_id);
      if t.next_starts_at > p_at + interval '1 hour' and v_cap >= 2
         and public.world_host_ineligible_reason(t.host_id) is null then
        insert into public.meetups (host_id, club_id, garage_user_id, title, theme, starts_at, ends_at,
                                    capacity, visibility)
          values (t.host_id, t.club_id, t.host_id, t.title, t.theme, t.next_starts_at,
                  t.next_starts_at + make_interval(mins => t.duration_minutes),
                  least(t.capacity, v_cap), t.visibility)
          returning * into v_meetup;
        perform public.emit_event(t.host_id, 'meetup.created', 'meetup', v_meetup.id, jsonb_build_object(
          'capacity', v_meetup.capacity, 'visibility', v_meetup.visibility, 'starts_at', v_meetup.starts_at,
          'club_id', t.club_id, 'recurring', true, 'template_id', t.id));
        insert into public.notifications (user_id, type, payload)
          values (t.host_id, 'club_night_ready', jsonb_build_object(
            'meetup_id', v_meetup.id, 'title', v_meetup.title, 'starts_at', v_meetup.starts_at, 'club_id', t.club_id));
        update public.club_night_templates set last_meetup_id = v_meetup.id where id = t.id;
        v_spawned := v_spawned + 1;
      else
        v_skipped := v_skipped + 1;
      end if;
      t.next_starts_at := case when t.cadence = 'weekly' then t.next_starts_at + interval '7 days'
                               else t.next_starts_at + interval '1 month' end;
    end loop;
    update public.club_night_templates set next_starts_at = t.next_starts_at where id = t.id;
  end loop;
  return jsonb_build_object('spawned', v_spawned, 'skipped', v_skipped, 'stopped', v_stopped);
end; $$;
revoke execute on function public.world_job_club_nights(timestamptz) from public, anon, authenticated;
grant execute on function public.world_job_club_nights(timestamptz) to service_role;

-- run_meetup_jobs — 0015's dispatcher with `club_nights` added to its job list (same contract; the
-- `meetups_tick` schedule already calls it with 'all', so no cron change is needed).
create or replace function public.run_meetup_jobs(
  p_job    text default 'all',
  p_at     timestamptz default now(),
  p_source text default null
)
returns setof public.job_runs
language plpgsql security definer set search_path = public as $$
declare
  c_jobs   constant text[] := array['meetup_transitions', 'meetup_reminders', 'club_nights'];
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
      elsif v_job = 'club_nights'        then v_result := public.world_job_club_nights(coalesce(p_at, now()));
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

notify pgrst, 'reload schema';
