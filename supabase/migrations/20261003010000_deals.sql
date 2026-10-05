-- 0007_deals — MV-S5-01, F-08, 03-data-model.md §2.7/2.9/2.20, ADR (offer state machine).
--
-- Offers + the transition_offer RPC (the ONLY way an offer's status changes, D-021/rule 8),
-- the per-buyer rate-limit trigger, the notifications table (created early for S5 consumers),
-- and the seller_reviews.offer_id FK. All dark behind the `offers` flag (seeded OFF). The offer
-- state machine:
--   pending --accept--> accepted --complete--> completed
--     |         \--decline--> declined    \--cancel--> cancelled
--     |--withdraw--> withdrawn
--     \--(72h, cron S9)--> expired

create type public.offer_type as enum ('cash', 'buy_now', 'trade');
create type public.offer_status as enum (
  'pending', 'accepted', 'declined', 'withdrawn', 'expired', 'completed', 'cancelled'
);

create table public.offers (
  id             uuid primary key default gen_random_uuid(),
  listing_id     uuid not null references public.marketplace_listings(id) on delete cascade,
  buyer_id       uuid not null references public.profiles(id) on delete cascade,
  seller_id      uuid not null references public.profiles(id) on delete cascade, -- denorm for RLS
  type           public.offer_type not null,
  amount         numeric(10, 2),
  currency       char(3),
  trade_item_ids uuid[] not null default '{}',
  message        text check (message is null or char_length(message) <= 500),
  status         public.offer_status not null default 'pending',
  responded_at   timestamptz,
  completed_at   timestamptz,
  expires_at     timestamptz not null default now() + interval '72 hours',
  created_at     timestamptz not null default now()
);
create index offers_listing_idx on public.offers (listing_id, status);
create index offers_buyer_idx on public.offers (buyer_id, created_at desc);
create index offers_seller_idx on public.offers (seller_id, status, created_at desc);
-- one pending offer per buyer per listing (§2.7)
create unique index offers_one_pending_idx on public.offers (listing_id, buyer_id) where status = 'pending';
alter table public.offers enable row level security;

-- buyer or seller read; buyer inserts their own; NO update policy — status moves only via the RPC.
create policy "Buyer or seller read offers" on public.offers for select
  using (buyer_id = auth.uid() or seller_id = auth.uid());
create policy "Buyer creates their own offer" on public.offers for insert
  with check (buyer_id = auth.uid());
grant select, insert on public.offers to authenticated;

-- now that offers exists, point marketplace_listings.sold_offer_id at it (§2.6; column added in 0006)
alter table public.marketplace_listings
  add constraint marketplace_listings_sold_offer_fk
  foreign key (sold_offer_id) references public.offers(id) on delete set null;

-- ---------- rate limit: <=5/h, <=20/day per buyer (§2.7) ----------
create or replace function public.check_offer_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare h integer; d integer;
begin
  select count(*) into h from public.offers
    where buyer_id = new.buyer_id and created_at > now() - interval '1 hour';
  if h >= 5 then raise exception 'offer_rate_limit_hour' using errcode = 'P0001'; end if;
  select count(*) into d from public.offers
    where buyer_id = new.buyer_id and created_at > now() - interval '1 day';
  if d >= 20 then raise exception 'offer_rate_limit_day' using errcode = 'P0001'; end if;
  return new;
end; $$;
create trigger check_offer_rate_limit before insert on public.offers
  for each row execute function public.check_offer_rate_limit();

-- ---------- transition_offer: the only path for status changes (rule 8, D-021) ----------
-- SECURITY DEFINER with explicit role checks + row locks. Locks the offer and its listing FOR
-- UPDATE so two concurrent accepts can't both reserve the same listing (F-08 AC). Emits a
-- domain_events row per state change (rule 9); the notification consumer (S5-06) reads those.
create or replace function public.transition_offer(p_offer_id uuid, p_action text)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer   public.offers;
  v_listing public.marketplace_listings;
  v_uid     uuid := auth.uid();
  v_sibling uuid;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then raise exception 'offer_not_found' using errcode = 'P0002'; end if;
  select * into v_listing from public.marketplace_listings where id = v_offer.listing_id for update;

  if p_action = 'accept' then
    if v_uid is distinct from v_offer.seller_id then raise exception 'not_authorized' using errcode = '42501'; end if;
    if v_offer.status <> 'pending' then raise exception 'invalid_transition' using errcode = 'P0001'; end if;
    if v_listing.status <> 'active' then raise exception 'listing_not_available' using errcode = 'P0001'; end if;
    update public.offers set status = 'accepted', responded_at = now() where id = v_offer.id;
    update public.marketplace_listings set status = 'reserved' where id = v_listing.id;
    -- auto-decline the listing's other pending offers, emitting an event for each
    for v_sibling in
      select id from public.offers where listing_id = v_listing.id and status = 'pending' and id <> v_offer.id
    loop
      update public.offers set status = 'declined', responded_at = now() where id = v_sibling;
      insert into public.domain_events (actor_id, type, entity, entity_id, payload)
        values (v_uid, 'offer.declined', 'offer', v_sibling, jsonb_build_object('reason', 'auto_declined'));
    end loop;
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (v_uid, 'offer.accepted', 'offer', v_offer.id, '{}'::jsonb);

  elsif p_action = 'decline' then
    if v_uid is distinct from v_offer.seller_id then raise exception 'not_authorized' using errcode = '42501'; end if;
    if v_offer.status <> 'pending' then raise exception 'invalid_transition' using errcode = 'P0001'; end if;
    update public.offers set status = 'declined', responded_at = now() where id = v_offer.id;
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (v_uid, 'offer.declined', 'offer', v_offer.id, '{}'::jsonb);

  elsif p_action = 'withdraw' then
    if v_uid is distinct from v_offer.buyer_id then raise exception 'not_authorized' using errcode = '42501'; end if;
    if v_offer.status <> 'pending' then raise exception 'invalid_transition' using errcode = 'P0001'; end if;
    update public.offers set status = 'withdrawn', responded_at = now() where id = v_offer.id;
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (v_uid, 'offer.withdrawn', 'offer', v_offer.id, '{}'::jsonb);

  elsif p_action = 'complete' then
    if v_uid is distinct from v_offer.seller_id then raise exception 'not_authorized' using errcode = '42501'; end if;
    if v_offer.status <> 'accepted' then raise exception 'invalid_transition' using errcode = 'P0001'; end if;
    update public.offers set status = 'completed', completed_at = now() where id = v_offer.id;
    update public.marketplace_listings
      set status = 'sold', sold_offer_id = v_offer.id, sold_at = now() where id = v_listing.id;
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (v_uid, 'offer.completed', 'offer', v_offer.id, '{}'::jsonb);
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (v_uid, 'listing.sold', 'listing', v_listing.id, jsonb_build_object('offer_id', v_offer.id));

  elsif p_action = 'cancel' then
    if v_uid is distinct from v_offer.buyer_id and v_uid is distinct from v_offer.seller_id then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
    if v_offer.status <> 'accepted' then raise exception 'invalid_transition' using errcode = 'P0001'; end if;
    update public.offers set status = 'cancelled', responded_at = now() where id = v_offer.id;
    -- release the listing back to active so it can receive offers again
    update public.marketplace_listings set status = 'active' where id = v_listing.id and status = 'reserved';
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (v_uid, 'offer.cancelled', 'offer', v_offer.id, '{}'::jsonb);

  else
    raise exception 'unknown_action: %', p_action using errcode = 'P0001';
  end if;

  select * into v_offer from public.offers where id = p_offer_id;
  return v_offer;
end; $$;
grant execute on function public.transition_offer(uuid, text) to authenticated;

-- ---------- notifications (§2.20; table only — the event consumer lands in S5-06) ----------
create type public.notification_type as enum (
  'offer_received', 'offer_accepted', 'offer_declined', 'message',
  'listing_sold', 'review_received', 'badge_unlocked', 'wishlist_match', 'system'
);
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       public.notification_type not null,
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "Users read their own notifications" on public.notifications for select
  using (user_id = auth.uid());
create policy "Users update their own notifications" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, update on public.notifications to authenticated;
-- Inserts come from the event consumer / service role (S5-06), not from clients.

-- ---------- seller_reviews: offer_id becomes a unique FK to offers (§2.9) ----------
-- One review per completed deal. buyer_name is kept for now; its drop rides the review feature's
-- own release (F-10, later) — D-006 two-release, same as the other denormalised columns.
alter table public.seller_reviews
  alter column offer_id type uuid using nullif(offer_id, '')::uuid;
alter table public.seller_reviews
  add constraint seller_reviews_offer_fk foreign key (offer_id) references public.offers(id) on delete set null;
create unique index seller_reviews_offer_unique_idx on public.seller_reviews (offer_id) where offer_id is not null;

notify pgrst, 'reload schema';
