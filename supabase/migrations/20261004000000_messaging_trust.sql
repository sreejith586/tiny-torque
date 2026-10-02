-- 0008_messaging_trust — MV-S6-01, F-09/F-15, 03-data-model.md §2.8/2.19, ADR (deal chat + trust).
--
-- Deal chat (deal_messages), blocks, reports resolution fields, profiles.suspended_until, and the
-- Realtime publication for chat + notifications. Also closes the S5-02-deferred offer block check:
-- create_offer / buy_now are redefined to reject a blocked pair. All dark behind the `deal_chat`
-- flag (seeded OFF). Messages insert ONLY when the offer is accepted/completed, the sender is a
-- party, and neither party has blocked the other (F-09 AC + §2.8).

-- ---------- profiles.suspended_until (F-16 admin suspend) ----------
alter table public.profiles add column if not exists suspended_until timestamptz;

-- ---------- blocks (§2.19) ----------
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocks enable row level security;
create policy "Users manage their own blocks" on public.blocks for all
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create index blocks_blocked_idx on public.blocks (blocked_id);
grant select, insert, delete on public.blocks to authenticated;

create or replace function public.is_blocked(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

-- ---------- deal_messages (§2.8, F-09) ----------
create table public.deal_messages (
  id         uuid primary key default gen_random_uuid(),
  offer_id   uuid not null references public.offers(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index deal_messages_offer_idx on public.deal_messages (offer_id, created_at);
alter table public.deal_messages enable row level security;

-- a party to the offer may read the thread (stays readable after completion)
create policy "Offer parties read the thread" on public.deal_messages for select
  using (exists (
    select 1 from public.offers o
    where o.id = offer_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
  ));
-- insert only on an accepted/completed offer, by a party, with no block between the two parties
create policy "Parties message on a live deal" on public.deal_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.offers o
      where o.id = offer_id and o.status in ('accepted', 'completed')
        and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
        and not public.is_blocked(o.buyer_id, o.seller_id)
    )
  );
-- read receipts: a party may set read_at (column-scoped grant keeps it to that column)
create policy "Parties update read state" on public.deal_messages for update
  using (exists (
    select 1 from public.offers o
    where o.id = offer_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
  ));
grant select, insert on public.deal_messages to authenticated;
grant update (read_at) on public.deal_messages to authenticated;

-- ---------- reports v2: resolution fields (§2.19; admin read/update policies already exist) ----------
alter table public.reports
  add column if not exists resolved_by      uuid references public.profiles(id) on delete set null,
  add column if not exists resolved_at      timestamptz,
  add column if not exists resolution_note  text;

-- ---------- close the S5-02-deferred offer block check ----------
-- Redefine create_offer / buy_now (CREATE OR REPLACE in a forward migration, not editing the
-- applied 0007b, D-006) to reject an offer when the buyer and seller have a block either way.
create or replace function public.create_offer(
  p_listing_id     uuid,
  p_type           public.offer_type,
  p_amount         numeric default null,
  p_trade_item_ids uuid[] default '{}',
  p_message        text default null
)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare v_listing public.marketplace_listings; v_uid uuid := auth.uid(); v_offer public.offers; v_n integer;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_message is not null and char_length(p_message) > 500 then raise exception 'message_too_long' using errcode = 'P0001'; end if;
  select * into v_listing from public.marketplace_listings where id = p_listing_id and deleted_at is null;
  if not found then raise exception 'listing_not_found' using errcode = 'P0002'; end if;
  if v_uid = v_listing.seller_id then raise exception 'cannot_offer_on_own_listing' using errcode = 'P0001'; end if;
  if v_listing.status <> 'active' then raise exception 'listing_not_available' using errcode = 'P0001'; end if;
  if public.is_blocked(v_uid, v_listing.seller_id) then raise exception 'blocked' using errcode = 'P0001'; end if;

  if p_type = 'cash' then
    if not v_listing.open_to_offers then raise exception 'not_open_to_offers' using errcode = 'P0001'; end if;
    if p_amount is null or p_amount <= 0 then raise exception 'amount_required' using errcode = 'P0001'; end if;
    if p_amount < coalesce(v_listing.min_offer, v_listing.price) then raise exception 'below_min_offer' using errcode = 'P0001'; end if;
    if p_amount > v_listing.price * 3 then raise exception 'above_sanity_cap' using errcode = 'P0001'; end if;
    p_trade_item_ids := '{}';
  elsif p_type = 'trade' then
    if v_listing.listing_type = 'sale' then raise exception 'not_open_to_trade' using errcode = 'P0001'; end if;
    v_n := coalesce(array_length(p_trade_item_ids, 1), 0);
    if v_n < 1 or v_n > 3 then raise exception 'trade_items_1_to_3' using errcode = 'P0001'; end if;
    if (select count(*) from public.collection_items
          where id = any(p_trade_item_ids) and owner_id = v_uid and is_public and deleted_at is null) <> v_n then
      raise exception 'trade_item_invalid' using errcode = 'P0001';
    end if;
  else
    raise exception 'use_buy_now_rpc' using errcode = 'P0001';
  end if;

  insert into public.offers (listing_id, buyer_id, seller_id, type, amount, currency, trade_item_ids, message, status)
    values (p_listing_id, v_uid, v_listing.seller_id, p_type, p_amount, v_listing.currency,
            coalesce(p_trade_item_ids, '{}'), p_message, 'pending')
    returning * into v_offer;
  insert into public.domain_events (actor_id, type, entity, entity_id, payload)
    values (v_uid, 'offer.created', 'offer', v_offer.id, jsonb_build_object('type', p_type::text));
  return v_offer;
end; $$;

create or replace function public.buy_now(p_listing_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare v_listing public.marketplace_listings; v_uid uuid := auth.uid(); v_offer public.offers; v_sibling uuid;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_listing from public.marketplace_listings where id = p_listing_id for update;
  if not found then raise exception 'listing_not_found' using errcode = 'P0002'; end if;
  if v_uid = v_listing.seller_id then raise exception 'cannot_buy_own_listing' using errcode = 'P0001'; end if;
  if v_listing.status <> 'active' then raise exception 'listing_not_available' using errcode = 'P0001'; end if;
  if v_listing.listing_type = 'trade' then raise exception 'not_for_sale' using errcode = 'P0001'; end if;
  if public.is_blocked(v_uid, v_listing.seller_id) then raise exception 'blocked' using errcode = 'P0001'; end if;

  insert into public.offers (listing_id, buyer_id, seller_id, type, amount, currency, status, responded_at)
    values (p_listing_id, v_uid, v_listing.seller_id, 'buy_now', v_listing.price, v_listing.currency, 'accepted', now())
    returning * into v_offer;
  update public.marketplace_listings set status = 'reserved' where id = p_listing_id;

  for v_sibling in select id from public.offers where listing_id = p_listing_id and status = 'pending' loop
    update public.offers set status = 'declined', responded_at = now() where id = v_sibling;
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (v_uid, 'offer.declined', 'offer', v_sibling, jsonb_build_object('reason', 'auto_declined'));
  end loop;

  insert into public.domain_events (actor_id, type, entity, entity_id, payload)
    values (v_uid, 'offer.created', 'offer', v_offer.id, jsonb_build_object('type', 'buy_now'));
  insert into public.domain_events (actor_id, type, entity, entity_id, payload)
    values (v_uid, 'offer.accepted', 'offer', v_offer.id, '{}'::jsonb);
  return v_offer;
end; $$;

-- ---------- Realtime publication (guarded — the publication only exists on the Supabase stack) ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'deal_messages') then
      alter publication supabase_realtime add table public.deal_messages;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';
