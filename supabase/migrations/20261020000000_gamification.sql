-- 0020_gamification — MV-S8-01/02/04/05, F-13/F-14, 03-data-model.md §2.18 (+ §2.1 banner).
--
-- Gamification (F-13): `achievements` reference table seeded with Varun's five badges,
-- `user_achievements` progress rows, and the two RPCs the app-side consumer uses —
-- gamification_events() (the only way a non-admin reads domain_events: a definer function that
-- returns ONLY the events relevant to the caller's own XP/badges) and apply_gamification() (the
-- only way profiles.xp/level and user_achievements ever change; a BEFORE UPDATE trigger on profiles
-- rejects any other write to those two columns). XP rules and the level table live in code
-- (src/domain/gamification/rules.ts, §2.18) so the consumer is replayable; this migration only
-- stores the computed result and emits xp.granted / badge.unlocked + the badge notification.
--
-- Also closes a pre-existing rule-9 gap: collection_items inserts never emitted `item.created`
-- (domain/garage's service had no emitEvent at all), and nothing emitted anything when an item
-- got its first photo. Both become AFTER INSERT triggers here (atomic with the write, same pattern
-- as deal_messages' message.sent trigger in 0017), because F-13's "add item +10" and "first photo
-- +5" XP rules have nothing to count otherwise.
--
-- Profile completeness (F-14): profiles.banner_media_id (03 §2.1's `banner_url → banner_media_id`),
-- public_profiles gains avatar/banner media ids, avatar/banner media becomes publicly readable
-- (media_is_public + a profile-media storage policy — 0004's own comment deferred both to F-14),
-- a `feedback` table for the settings feedback form, and delete_account(): the full anonymise +
-- cascade F-01 describes, replacing the S1 stub that only overwrote the profile row.

-- ---------- achievements (reference, seeded; §2.18) ----------
create table public.achievements (
  key         text primary key,
  name        text not null,
  description text not null,
  rule        jsonb not null default '{}'::jsonb,
  icon        text not null default 'trophy',
  sort_order  integer not null default 0
);
alter table public.achievements enable row level security;
create policy "Anyone reads achievements" on public.achievements for select using (true);
grant select on public.achievements to anon, authenticated;

-- Varun's five (03 §2.18). `rule` is data the evaluator in rules.ts reads (kind + threshold) so a
-- threshold change is a data-only migration; the evaluator kinds themselves are code.
-- value_collector's 1000 is a PLACEHOLDER threshold in the collector's own currency units.
insert into public.achievements (key, name, description, rule, icon, sort_order) values
  ('first_add',       'First Add',        'Add your first car to the garage.',
     '{"kind":"event_count","event":"item.created","threshold":1}', 'add', 1),
  ('growing_garage',  'Growing Garage',   'Reach 25 cars in your garage.',
     '{"kind":"stat","stat":"totalItems","threshold":25}', 'garage', 2),
  ('treasure_hunter', 'Treasure Hunter',  'Own 5 cars rarer than common.',
     '{"kind":"stat","stat":"rareItems","threshold":5}', 'bolt', 3),
  ('deal_maker',      'Deal Maker',       'Complete your first deal.',
     '{"kind":"event_count","event":"offer.completed","threshold":1}', 'offers', 4),
  ('value_collector', 'Value Collector',  'Your collection is worth 1,000 or more.',
     '{"kind":"stat","stat":"totalValue","threshold":1000}', 'market', 5);

-- ---------- user_achievements (§2.18) ----------
create table public.user_achievements (
  user_id         uuid not null references public.profiles(id) on delete cascade,
  achievement_key text not null references public.achievements(key),
  progress        integer not null default 0,
  unlocked_at     timestamptz,
  updated_at      timestamptz not null default now(),
  primary key (user_id, achievement_key)
);
create index user_achievements_unlocked_idx on public.user_achievements (user_id, unlocked_at);
alter table public.user_achievements enable row level security;
create policy "Users read their own achievements" on public.user_achievements for select
  using (user_id = auth.uid());
create policy "Admins read all achievements progress" on public.user_achievements for select
  using (public.is_admin());
grant select on public.user_achievements to authenticated;
-- No insert/update/delete policies: rows change only via apply_gamification() below.

-- ---------- item events the XP rules count (rule 9 gap, see header) ----------
create or replace function public.emit_item_created_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.domain_events (actor_id, type, entity, entity_id, payload)
    values (new.owner_id, 'item.created', 'item', new.id,
            jsonb_build_object('brand', new.brand, 'qty', new.qty));
  return new;
end; $$;
create trigger collection_items_emit_created
  after insert on public.collection_items
  for each row execute function public.emit_item_created_event();

-- First photo on an item (+5 XP, F-13): only when no other live media row for the item sorts
-- before this one. AFTER ROW triggers fire once the whole statement has inserted, so a multi-row
-- insert's rows all see each other — a plain "no other row exists" check would emit nothing. The
-- (created_at, id) tiebreak makes exactly one row of any batch the first.
create or replace function public.emit_item_photo_added_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'item' and new.entity_id is not null and not exists (
    select 1 from public.media m
    where m.kind = 'item' and m.entity_id = new.entity_id and m.id <> new.id
      and m.status in ('uploading', 'ready')
      and (m.created_at, m.id) < (new.created_at, new.id)
  ) then
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (new.owner_id, 'item.photo_added', 'item', new.entity_id,
              jsonb_build_object('media_id', new.id));
  end if;
  return new;
end; $$;
create trigger media_emit_first_photo
  after insert on public.media
  for each row execute function public.emit_item_photo_added_event();

-- ---------- profiles.xp / level are consumer-maintained only ----------
-- Table-level UPDATE is granted on profiles (0001 grants), so a column REVOKE can't narrow it;
-- a trigger guard is the honest way to make "maintained by gamification consumer" (03 §2.1) true.
-- apply_gamification() sets the transaction-local flag before writing.
create or replace function public.guard_gamification_columns() returns trigger
language plpgsql as $$
begin
  if (new.xp is distinct from old.xp or new.level is distinct from old.level)
     and coalesce(current_setting('mv.gamification_write', true), '') <> '1' then
    raise exception 'xp_level_read_only' using errcode = '42501',
      hint = 'profiles.xp/level change only through apply_gamification()';
  end if;
  return new;
end; $$;
create trigger profiles_guard_gamification
  before update on public.profiles
  for each row execute function public.guard_gamification_columns();

-- ---------- service-role check shared by the two RPCs ----------
-- auth.role() can be NULL (older auth schema versions / test harnesses only set request.jwt.claims),
-- and `NULL <> 'service_role'` is NULL — which would silently let the authorization check through.
-- Coalesce, and also read the claims JSON directly, so "not the service role" is always a real false.
create or replace function public.mv_is_backend_caller() returns boolean
language sql stable as $$
  select coalesce(auth.role(), '') = 'service_role'
      or coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role';
$$;

-- ---------- gamification_events: the consumer's read path ----------
-- domain_events is admin-read-only (0002). This returns just the events that feed the caller's own
-- XP/badges: everything they did themselves, plus the two cross-actor cases — offer.completed is
-- emitted by the seller but pays both sides (buyer/seller ids are joined in from offers since the
-- stored payload is '{}'), and review.created is emitted by the buyer but pays the seller.
-- Admins / the service role (replay script) may ask for any user.
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
                   'review.created', 'user.opened')
    and (
      e.actor_id = p_user
      or (e.type = 'offer.completed' and (o.buyer_id = p_user or o.seller_id = p_user))
      or (e.type = 'review.created' and e.payload->>'seller_id' = p_user::text)
    )
  order by e.occurred_at, e.id;
$$;
grant execute on function public.gamification_events(uuid) to authenticated, service_role;

-- ---------- apply_gamification: the consumer's write path ----------
-- p_badges: [{"key": "first_add", "progress": 1, "unlocked": true}, ...]. Unlocks are permanent
-- (unlocked_at is never cleared even if progress later drops). Returns
-- {"xp_delta": n, "newly_unlocked": ["key", ...]} so the caller can show the unlock toast.
create or replace function public.apply_gamification(
  p_user uuid, p_xp integer, p_level integer, p_badges jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_old_xp    integer;
  v_old_level integer;
  v_delta     integer := 0;
  v_badge     jsonb;
  v_key       text;
  v_progress  integer;
  v_unlocked  boolean;
  v_existing  public.user_achievements;
  v_new       text[] := '{}';
begin
  if p_user is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_user is distinct from auth.uid() and not public.is_admin() and not public.mv_is_backend_caller() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_xp < 0 or p_level < 0 then raise exception 'invalid_state' using errcode = 'P0001'; end if;

  select xp, level into v_old_xp, v_old_level from public.profiles where id = p_user for update;
  if not found then raise exception 'profile_not_found' using errcode = 'P0002'; end if;

  if v_old_xp is distinct from p_xp or v_old_level is distinct from p_level then
    perform set_config('mv.gamification_write', '1', true);
    update public.profiles set xp = p_xp, level = p_level where id = p_user;
    perform set_config('mv.gamification_write', '0', true);
    v_delta := p_xp - v_old_xp;
    if v_delta <> 0 then
      insert into public.domain_events (actor_id, type, entity, entity_id, payload)
        values (p_user, 'xp.granted', 'profile', p_user,
                jsonb_build_object('delta', v_delta, 'xp', p_xp, 'level', p_level));
    end if;
  end if;

  for v_badge in select * from jsonb_array_elements(coalesce(p_badges, '[]'::jsonb)) loop
    v_key := v_badge->>'key';
    v_progress := coalesce((v_badge->>'progress')::integer, 0);
    v_unlocked := coalesce((v_badge->>'unlocked')::boolean, false);
    if v_key is null or not exists (select 1 from public.achievements where key = v_key) then
      continue;
    end if;
    select * into v_existing from public.user_achievements
      where user_id = p_user and achievement_key = v_key;
    if not found then
      insert into public.user_achievements (user_id, achievement_key, progress, unlocked_at)
        values (p_user, v_key, v_progress, case when v_unlocked then now() end);
      if v_unlocked then v_new := array_append(v_new, v_key); end if;
    else
      update public.user_achievements
        set progress = v_progress,
            unlocked_at = coalesce(v_existing.unlocked_at, case when v_unlocked then now() end),
            updated_at = now()
        where user_id = p_user and achievement_key = v_key;
      if v_unlocked and v_existing.unlocked_at is null then v_new := array_append(v_new, v_key); end if;
    end if;
  end loop;

  foreach v_key in array v_new loop
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (p_user, 'badge.unlocked', 'badge', null, jsonb_build_object('achievement_key', v_key));
    insert into public.notifications (user_id, type, payload)
      values (p_user, 'badge_unlocked', jsonb_build_object('achievement_key', v_key));
  end loop;

  return jsonb_build_object('xp_delta', v_delta, 'newly_unlocked', to_jsonb(v_new));
end; $$;
grant execute on function public.apply_gamification(uuid, integer, integer, jsonb)
  to authenticated, service_role;

-- ---------- profiles.banner_media_id + public_profiles avatar/banner (F-14, §2.1) ----------
alter table public.profiles
  add column if not exists banner_media_id uuid references public.media(id) on delete set null;

-- Appends only (create or replace view can't reorder/retype existing columns). `avatar_media_id`
-- is profiles.photo_url, which has held a media row id since 0004 (D-010), not a URL.
create or replace view public.public_profiles as
select id, handle, display_name, account_type, store_name, country_code, city, bio, level, xp, created_at,
       (pro_until is not null and pro_until > now()) as is_pro,
       rating_avg, rating_count,
       photo_url as avatar_media_id,
       banner_media_id
from public.profiles
where deleted_at is null
  and not public.is_blocked(auth.uid(), id);

-- Avatar/banner media of a live profile is public (0004 deferred this to F-14). The storage
-- object policy mirrors it so /api/media/{id} can sign the URL without a session.
create or replace function public.media_is_public(p_media_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.media m
    join public.collection_items ci on ci.id = m.entity_id
    where m.id = p_media_id
      and m.kind = 'item'
      and ci.is_public = true
      and ci.deleted_at is null
  ) or exists (
    select 1
    from public.media m
    join public.profiles p on p.id = m.owner_id
    where m.id = p_media_id
      and m.kind in ('avatar', 'banner')
      and m.status = 'ready'
      and p.deleted_at is null
  );
$$;

create policy "Public profile media objects are readable"
  on storage.objects for select
  using (
    bucket_id = 'profile-media'
    and exists (
      select 1
      from public.media m
      join public.profiles p on p.id = m.owner_id
      where m.bucket = 'profile-media'
        and m.path = storage.objects.name
        and m.kind in ('avatar', 'banner')
        and m.status = 'ready'
        and p.deleted_at is null
    )
  );

-- ---------- blocked_users: the settings "blocked users" list (F-14) ----------
-- public_profiles hides a blocked user from the blocker (0016), so the blocker can't resolve the
-- names on their own block list through the view. This definer function returns just the name +
-- handle of the people the CALLER blocked — nothing about anyone else.
create or replace function public.blocked_users()
returns table (blocked_id uuid, display_name text, handle text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.blocked_id, p.display_name, p.handle::text, b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;
grant execute on function public.blocked_users() to authenticated;

-- ---------- feedback (F-14 settings: feedback / bug report) ----------
create type public.feedback_kind as enum ('bug', 'idea', 'other');
create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       public.feedback_kind not null default 'other',
  message    text not null check (char_length(message) between 3 and 2000),
  page       text,
  created_at timestamptz not null default now()
);
create index feedback_created_idx on public.feedback (created_at desc);
alter table public.feedback enable row level security;
create policy "Users submit their own feedback" on public.feedback for insert
  with check (user_id = auth.uid());
create policy "Admins read feedback" on public.feedback for select
  using (public.is_admin());
grant insert, select on public.feedback to authenticated;

create or replace function public.emit_feedback_created_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.domain_events (actor_id, type, entity, entity_id, payload)
    values (new.user_id, 'feedback.created', 'profile', new.id, jsonb_build_object('kind', new.kind));
  return new;
end; $$;
create trigger feedback_emit_created
  after insert on public.feedback
  for each row execute function public.emit_feedback_created_event();

-- ---------- delete_account: anonymise + cascade (F-01/F-14, replaces the S1 stub) ----------
-- Caller-only (auth.uid()). Order matters: offers are settled through transition_offer (D-021 — the
-- only path offer status changes), THEN listings are removed (cancel releases a reserved listing
-- back to active first), then items/media/social rows, then the profile itself. Ledger rows stay
-- (finance, F-01). The auth.users row and the storage objects need the service role and are left
-- for the S9 jobs function; the proxy signs a deleted profile out on its next request meanwhile.
create or replace function public.delete_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_offer   record;
  v_listing uuid;
begin
  if v_uid is null then raise exception 'Sign in required' using errcode = '28000'; end if;

  for v_offer in
    select id, buyer_id from public.offers
    where (buyer_id = v_uid or seller_id = v_uid) and status = 'pending'
  loop
    perform public.transition_offer(v_offer.id, case when v_offer.buyer_id = v_uid then 'withdraw' else 'decline' end);
  end loop;
  for v_offer in
    select id from public.offers where (buyer_id = v_uid or seller_id = v_uid) and status = 'accepted'
  loop
    perform public.transition_offer(v_offer.id, 'cancel');
  end loop;

  for v_listing in
    select id from public.marketplace_listings
    where seller_id = v_uid and deleted_at is null and status in ('active', 'reserved')
  loop
    update public.marketplace_listings set status = 'removed', deleted_at = now() where id = v_listing;
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (v_uid, 'listing.removed', 'listing', v_listing, jsonb_build_object('reason', 'account_deleted'));
  end loop;
  -- Denormalised seller PII on every listing row (sold history included), rule 15.
  update public.marketplace_listings
    set seller_name = 'Deleted collector', seller_mobile = null, seller_photo = null, seller_location = null
    where seller_id = v_uid;

  update public.collection_items set deleted_at = now() where owner_id = v_uid and deleted_at is null;
  update public.media set status = 'removed' where owner_id = v_uid and status <> 'removed';
  delete from public.wishlist_items where owner_id = v_uid;
  delete from public.listing_favorites where user_id = v_uid;
  delete from public.follows where follower_id = v_uid or followee_id = v_uid;
  delete from public.blocks where blocker_id = v_uid;
  delete from public.notifications where user_id = v_uid;

  update public.profiles
    set deleted_at = now(),
        display_name = 'Deleted collector',
        mobile = null, bio = null, city = null, location = null, store_name = null,
        photo_url = null, banner_media_id = null
    where id = v_uid;

  insert into public.domain_events (actor_id, type, entity, entity_id, payload)
    values (v_uid, 'user.deleted', 'profile', v_uid, '{}'::jsonb);
end; $$;
grant execute on function public.delete_account() to authenticated;

notify pgrst, 'reload schema';
