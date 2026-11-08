-- 0013b_world_social — MV-W03-01 (+ the DB half of W03-02/04/05), F-21, 07 §2.2 / §6.6, 03 §2.32–2.36.
--
-- Garages become places people visit: visits (one row per visitor per day), kudos (one per day),
-- a host-moderated guestbook, and invites (expiring share tokens or direct invites by handle) that
-- unlock followers-only / invite-only garages. Still dark (D-028): no screen reads this until the
-- W03 views land and `world` turns on for the founders cohort.
--
-- One visibility rule, one place: world_garage_visible(garage, viewer) is used by the world_garages
-- SELECT policy (replacing 0012's inline policy) AND by every RPC here, so the open-house rules,
-- blocks and invites can never drift apart. Rate limits are triggers (07 §6.6), never app code.
-- Every write goes through a SECURITY DEFINER RPC (07 P4); the tables have no client write policy.

-- ---------- tables ----------
create table public.world_visits (
  id             uuid primary key default gen_random_uuid(),
  garage_user_id uuid not null references public.profiles(id) on delete cascade,
  visitor_id     uuid not null references public.profiles(id) on delete cascade,
  visited_on     date not null default current_date,
  created_at     timestamptz not null default now(),
  unique (garage_user_id, visitor_id, visited_on),
  check (garage_user_id <> visitor_id)
);
create index world_visits_garage_idx on public.world_visits (garage_user_id, created_at desc);
alter table public.world_visits enable row level security;
create policy "Owner and visitor read visits" on public.world_visits for select
  using (garage_user_id = auth.uid() or visitor_id = auth.uid() or public.is_admin());
grant select on public.world_visits to authenticated;

create table public.world_kudos (
  garage_user_id uuid not null references public.profiles(id) on delete cascade,
  giver_id       uuid not null references public.profiles(id) on delete cascade,
  given_on       date not null default current_date,
  created_at     timestamptz not null default now(),
  primary key (garage_user_id, giver_id, given_on),
  check (garage_user_id <> giver_id)
);
alter table public.world_kudos enable row level security;
create policy "Owner and giver read kudos" on public.world_kudos for select
  using (garage_user_id = auth.uid() or giver_id = auth.uid() or public.is_admin());
grant select on public.world_kudos to authenticated;

create table public.world_guestbook (
  id             uuid primary key default gen_random_uuid(),
  garage_user_id uuid not null references public.profiles(id) on delete cascade,
  author_id      uuid not null references public.profiles(id) on delete cascade,
  body           text not null check (char_length(body) between 1 and 140),
  hidden_by_host boolean not null default false,
  hidden_at      timestamptz,
  created_at     timestamptz not null default now()
);
create index world_guestbook_garage_idx on public.world_guestbook (garage_user_id, created_at desc);
alter table public.world_guestbook enable row level security;
grant select on public.world_guestbook to anon, authenticated;
-- select policy below, after world_garage_visible() exists

create table public.world_invites (
  id             uuid primary key default gen_random_uuid(),
  garage_user_id uuid not null references public.profiles(id) on delete cascade,
  -- share-link token (no pgcrypto dependency: two uuids, dashes stripped)
  token          text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invitee_id     uuid references public.profiles(id) on delete cascade,
  expires_at     timestamptz not null default now() + interval '7 days',
  max_uses       integer not null default 1 check (max_uses between 1 and 50),
  used_count     integer not null default 0 check (used_count >= 0),
  revoked_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index world_invites_garage_idx on public.world_invites (garage_user_id, created_at desc);
create index world_invites_invitee_idx on public.world_invites (invitee_id) where invitee_id is not null;
alter table public.world_invites enable row level security;
create policy "Host and invitee read invites" on public.world_invites for select
  using (garage_user_id = auth.uid() or invitee_id = auth.uid() or public.is_admin());
grant select on public.world_invites to authenticated;

create table public.world_invite_uses (
  invite_id  uuid not null references public.world_invites(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (invite_id, user_id)
);
alter table public.world_invite_uses enable row level security;
create policy "Host and user read invite uses" on public.world_invite_uses for select
  using (
    user_id = auth.uid() or public.is_admin()
    or exists (select 1 from public.world_invites i where i.id = invite_id and i.garage_user_id = auth.uid())
  );
grant select on public.world_invite_uses to authenticated;

-- ---------- counters on the garage (RPC-maintained, guard-protected) ----------
alter table public.world_garages
  add column if not exists visit_count integer not null default 0 check (visit_count >= 0),
  add column if not exists kudos_count integer not null default 0 check (kudos_count >= 0);

create or replace function public.world_garages_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.level is distinct from old.level
      or new.score is distinct from old.score
      or new.extra_slots is distinct from old.extra_slots
      or new.rename_count is distinct from old.rename_count
      or new.visit_count is distinct from old.visit_count
      or new.kudos_count is distinct from old.kudos_count
      or new.name is distinct from old.name
      or new.user_id <> old.user_id)
     and current_setting('mv.world_rpc', true) is distinct from 'on' then
    raise exception 'rpc_only_column' using errcode = '42501',
      hint = 'level/score/extra_slots/rename_count/visit_count/kudos_count/name change only through the World RPCs';
  end if;
  if new.theme_item_id is not null and new.theme_item_id is distinct from old.theme_item_id
     and not exists (
       select 1 from public.world_inventory i
       join public.world_items w on w.id = i.item_id
       where i.user_id = new.user_id and i.item_id = new.theme_item_id and w.kind = 'theme'
     ) then
    raise exception 'theme_not_owned' using errcode = 'P0001';
  end if;
  return new;
end; $$;

-- ---------- visibility: the one rule (07 §2.2 open house + blocks + invites) ----------
-- A live invite = not revoked, not expired, and either addressed to the viewer (direct) or
-- already used by the viewer (share link). Invites unlock any non-public garage.
create or replace function public.world_has_invite(p_garage uuid, p_viewer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_viewer is not null and exists (
    select 1 from public.world_invites i
    where i.garage_user_id = p_garage and i.revoked_at is null and i.expires_at > now()
      and (i.invitee_id = p_viewer
           or exists (select 1 from public.world_invite_uses u where u.invite_id = i.id and u.user_id = p_viewer))
  );
$$;

create or replace function public.world_garage_visible(p_garage uuid, p_viewer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.world_garages g
    where g.user_id = p_garage
      and (
        g.user_id = p_viewer
        or public.is_admin()
        or (
          not public.is_blocked(p_viewer, g.user_id)
          and (
            g.open_mode = 'public'
            or (g.open_mode = 'followers' and p_viewer is not null and exists (
                  select 1 from public.follows f where f.follower_id = p_viewer and f.followee_id = g.user_id))
            or public.world_has_invite(g.user_id, p_viewer)
          )
        )
      )
  );
$$;
grant execute on function public.world_garage_visible(uuid, uuid) to anon, authenticated;

drop policy if exists "Garage visibility follows open_mode" on public.world_garages;
create policy "Garage visibility follows open_mode" on public.world_garages for select
  using (public.world_garage_visible(user_id, auth.uid()));

-- Guestbook: readable wherever the garage is; a host-hidden line is the host's (and admin's) to see.
create policy "Guestbook follows garage visibility" on public.world_guestbook for select
  using (
    public.world_garage_visible(garage_user_id, auth.uid())
    and (not hidden_by_host or garage_user_id = auth.uid() or public.is_admin())
  );

-- ---------- open garages list (07 §2.2 'Open garages' page) ----------
-- Public garages joined to the public profile; blocks hide both ways per caller.
create or replace view public.world_open_garages as
  select g.user_id, g.name, g.level, g.score, g.featured_item_id, g.visit_count, g.kudos_count,
         g.updated_at, p.handle, p.display_name, p.country_code, p.city
  from public.world_garages g
  join public.public_profiles p on p.id = g.user_id
  where g.open_mode = 'public' and not public.is_blocked(auth.uid(), g.user_id);
grant select on public.world_open_garages to anon, authenticated;

-- ---------- notifications: new kinds (additive enum, used only at RPC run time) ----------
alter type public.notification_type add value if not exists 'world_visit';
alter type public.notification_type add value if not exists 'world_kudos';
alter type public.notification_type add value if not exists 'world_guestbook';
alter type public.notification_type add value if not exists 'world_invite';

-- ---------- rate limits as triggers (07 §6.6) ----------
create or replace function public.check_world_visit_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare h integer;
begin
  select count(*) into h from public.world_visits
    where visitor_id = new.visitor_id and created_at > now() - interval '1 hour';
  if h >= 60 then raise exception 'visit_rate_limit' using errcode = 'P0001'; end if;
  return new;
end; $$;
create trigger check_world_visit_rate_limit before insert on public.world_visits
  for each row execute function public.check_world_visit_rate_limit();

create or replace function public.check_world_guestbook_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare h integer; d integer;
begin
  select count(*) into h from public.world_guestbook
    where author_id = new.author_id and garage_user_id = new.garage_user_id
      and created_at > now() - interval '1 hour';
  if h >= 5 then raise exception 'guestbook_rate_limit' using errcode = 'P0001'; end if;
  select count(*) into d from public.world_guestbook
    where author_id = new.author_id and created_at > now() - interval '1 day';
  if d >= 30 then raise exception 'guestbook_rate_limit' using errcode = 'P0001'; end if;
  return new;
end; $$;
create trigger check_world_guestbook_rate_limit before insert on public.world_guestbook
  for each row execute function public.check_world_guestbook_rate_limit();

-- ---------- helpers ----------
create or replace function public.world_bump_counter(p_garage uuid, p_column text, p_delta integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('mv.world_rpc', 'on', true);
  if p_column = 'visit_count' then
    update public.world_garages set visit_count = greatest(0, visit_count + p_delta) where user_id = p_garage;
  elsif p_column = 'kudos_count' then
    update public.world_garages set kudos_count = greatest(0, kudos_count + p_delta) where user_id = p_garage;
  end if;
  perform set_config('mv.world_rpc', 'off', true);
end; $$;

-- ---------- record_world_visit: one row per visitor per day; owner visits are not visits ----------
create or replace function public.record_world_visit(p_garage uuid)
returns public.world_visits
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_row    public.world_visits;
  v_handle text;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if v_uid = p_garage then return null; end if;
  if not public.world_garage_visible(p_garage, v_uid) then
    raise exception 'garage_not_found' using errcode = 'P0002';
  end if;

  insert into public.world_visits (garage_user_id, visitor_id)
    values (p_garage, v_uid)
    on conflict (garage_user_id, visitor_id, visited_on) do nothing
    returning * into v_row;
  if v_row.id is null then
    select * into v_row from public.world_visits
      where garage_user_id = p_garage and visitor_id = v_uid and visited_on = current_date;
    return v_row; -- already counted today
  end if;

  perform public.world_bump_counter(p_garage, 'visit_count', 1);
  select handle into v_handle from public.profiles where id = v_uid;
  perform public.emit_event(v_uid, 'world.visited', 'garage', p_garage, jsonb_build_object('visit_id', v_row.id));
  insert into public.notifications (user_id, type, payload)
    values (p_garage, 'world_visit', jsonb_build_object('visitor_id', v_uid, 'handle', v_handle));
  return v_row;
end; $$;
grant execute on function public.record_world_visit(uuid) to authenticated;

-- ---------- give_world_kudos: one per giver per garage per day ("rev the engine") ----------
create or replace function public.give_world_kudos(p_garage uuid)
returns public.world_kudos
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_row    public.world_kudos;
  v_handle text;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if v_uid = p_garage then raise exception 'own_garage' using errcode = 'P0001'; end if;
  if not public.world_garage_visible(p_garage, v_uid) then
    raise exception 'garage_not_found' using errcode = 'P0002';
  end if;

  insert into public.world_kudos (garage_user_id, giver_id)
    values (p_garage, v_uid)
    on conflict (garage_user_id, giver_id, given_on) do nothing
    returning * into v_row;
  if v_row.giver_id is null then
    select * into v_row from public.world_kudos
      where garage_user_id = p_garage and giver_id = v_uid and given_on = current_date;
    return v_row; -- already given today
  end if;

  perform public.world_bump_counter(p_garage, 'kudos_count', 1);
  select handle into v_handle from public.profiles where id = v_uid;
  perform public.emit_event(v_uid, 'world.kudos_given', 'garage', p_garage, '{}'::jsonb);
  insert into public.notifications (user_id, type, payload)
    values (p_garage, 'world_kudos', jsonb_build_object('giver_id', v_uid, 'handle', v_handle));
  return v_row;
end; $$;
grant execute on function public.give_world_kudos(uuid) to authenticated;

-- ---------- guestbook: post (visitors + host), hide/unhide (host) ----------
-- The clean-language check lives in the service (lib/clean-language, MV-S6-04) — the DB enforces
-- length and the rate limit, which cannot be bypassed from a client.
create or replace function public.post_world_guestbook(p_garage uuid, p_body text)
returns public.world_guestbook
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_body   text := nullif(trim(p_body), '');
  v_row    public.world_guestbook;
  v_handle text;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if v_body is null or char_length(v_body) > 140 then raise exception 'invalid_body' using errcode = 'P0001'; end if;
  if not public.world_garage_visible(p_garage, v_uid) then
    raise exception 'garage_not_found' using errcode = 'P0002';
  end if;

  insert into public.world_guestbook (garage_user_id, author_id, body)
    values (p_garage, v_uid, v_body) returning * into v_row;

  perform public.emit_event(v_uid, 'world.guestbook_posted', 'garage', p_garage, jsonb_build_object('entry_id', v_row.id));
  if v_uid <> p_garage then
    select handle into v_handle from public.profiles where id = v_uid;
    insert into public.notifications (user_id, type, payload)
      values (p_garage, 'world_guestbook', jsonb_build_object('author_id', v_uid, 'handle', v_handle, 'entry_id', v_row.id));
  end if;
  return v_row;
end; $$;
grant execute on function public.post_world_guestbook(uuid, text) to authenticated;

create or replace function public.hide_world_guestbook(p_id uuid, p_hidden boolean default true)
returns public.world_guestbook
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.world_guestbook;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_row from public.world_guestbook where id = p_id;
  if not found then raise exception 'entry_not_found' using errcode = 'P0002'; end if;
  if v_row.garage_user_id <> v_uid and not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.world_guestbook
    set hidden_by_host = p_hidden, hidden_at = case when p_hidden then now() else null end
    where id = p_id returning * into v_row;
  perform public.emit_event(v_uid, 'world.guestbook_hidden', 'garage', v_row.garage_user_id,
    jsonb_build_object('entry_id', p_id, 'hidden', p_hidden, 'author_id', v_row.author_id));
  return v_row;
end; $$;
grant execute on function public.hide_world_guestbook(uuid, boolean) to authenticated;

-- ---------- invites: share link (token) or direct by handle; accept; revoke ----------
create or replace function public.create_world_invite(
  p_invitee_handle text default null,
  p_hours          integer default 168,
  p_max_uses       integer default 1
)
returns public.world_invites
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_invitee uuid;
  v_live    integer;
  v_row     public.world_invites;
  v_handle  text;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  perform public.ensure_world_garage();
  if p_hours < 1 or p_hours > 720 or p_max_uses < 1 or p_max_uses > 50 then
    raise exception 'invalid_invite' using errcode = 'P0001';
  end if;

  if p_invitee_handle is not null then
    select id into v_invitee from public.profiles
      where handle = lower(trim(p_invitee_handle)) and deleted_at is null;
    if v_invitee is null then raise exception 'invitee_not_found' using errcode = 'P0002'; end if;
    if v_invitee = v_uid or public.is_blocked(v_uid, v_invitee) then
      raise exception 'invalid_invite' using errcode = 'P0001';
    end if;
  end if;

  select count(*) into v_live from public.world_invites
    where garage_user_id = v_uid and revoked_at is null and expires_at > now();
  if v_live >= 20 then raise exception 'invite_limit' using errcode = 'P0001'; end if;

  insert into public.world_invites (garage_user_id, invitee_id, expires_at, max_uses)
    values (v_uid, v_invitee, now() + make_interval(hours => p_hours),
            case when v_invitee is null then p_max_uses else 1 end)
    returning * into v_row;

  perform public.emit_event(v_uid, 'world.invite_created', 'garage', v_uid,
    jsonb_build_object('invite_id', v_row.id, 'direct', v_invitee is not null));
  if v_invitee is not null then
    select handle into v_handle from public.profiles where id = v_uid;
    insert into public.notifications (user_id, type, payload)
      values (v_invitee, 'world_invite', jsonb_build_object('host_id', v_uid, 'handle', v_handle, 'invite_id', v_row.id));
  end if;
  return v_row;
end; $$;
grant execute on function public.create_world_invite(text, integer, integer) to authenticated;

create or replace function public.accept_world_invite(p_token text)
returns public.world_invites
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.world_invites;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_row from public.world_invites where token = p_token for update;
  if not found or v_row.revoked_at is not null or v_row.expires_at <= now()
     or v_row.garage_user_id = v_uid or public.is_blocked(v_uid, v_row.garage_user_id)
     or (v_row.invitee_id is not null and v_row.invitee_id <> v_uid) then
    raise exception 'invite_invalid' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.world_invite_uses where invite_id = v_row.id and user_id = v_uid) then
    return v_row; -- already accepted
  end if;
  if v_row.used_count >= v_row.max_uses then raise exception 'invite_invalid' using errcode = 'P0001'; end if;

  insert into public.world_invite_uses (invite_id, user_id) values (v_row.id, v_uid);
  update public.world_invites set used_count = used_count + 1 where id = v_row.id returning * into v_row;

  perform public.emit_event(v_uid, 'world.invite_accepted', 'garage', v_row.garage_user_id,
    jsonb_build_object('invite_id', v_row.id));
  return v_row;
end; $$;
grant execute on function public.accept_world_invite(text) to authenticated;

create or replace function public.revoke_world_invite(p_id uuid)
returns public.world_invites
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.world_invites;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  update public.world_invites set revoked_at = coalesce(revoked_at, now())
    where id = p_id and garage_user_id = v_uid returning * into v_row;
  if not found then raise exception 'invite_not_found' using errcode = 'P0002'; end if;
  perform public.emit_event(v_uid, 'world.invite_revoked', 'garage', v_uid, jsonb_build_object('invite_id', p_id));
  return v_row;
end; $$;
grant execute on function public.revoke_world_invite(uuid) to authenticated;

notify pgrst, 'reload schema';
