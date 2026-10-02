-- 0007b_offer_rpcs — MV-S5-02, F-08. Offer-creation RPCs (create_offer, buy_now).
--
-- All offer writes go through definer RPCs (D-021 / rule 8 — the guard forbids any direct
-- from('offers') write in app code), so creation validation lives here authoritatively rather than
-- only in the TS service. A follow-up migration (not editing the already-applied 0007 deals, D-006).
--
-- create_offer: validates the listing + offer terms (open_to_offers, >= min_offer, <= 3x price for
-- cash; 1-3 of the buyer's own public items for trade) and inserts a `pending` offer, emitting
-- offer.created. buy_now: buyer-initiated instant reserve (born `accepted` at price), since it
-- cannot go through transition_offer (whose `accept` is seller-only).

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
    -- every proposed item must be the buyer's own public, non-deleted item (F-08 AC)
    if (select count(*) from public.collection_items
          where id = any(p_trade_item_ids) and owner_id = v_uid and is_public and deleted_at is null) <> v_n then
      raise exception 'trade_item_invalid' using errcode = 'P0001';
    end if;
  else
    raise exception 'use_buy_now_rpc' using errcode = 'P0001'; -- buy_now has its own path
  end if;

  insert into public.offers (listing_id, buyer_id, seller_id, type, amount, currency, trade_item_ids, message, status)
    values (p_listing_id, v_uid, v_listing.seller_id, p_type, p_amount, v_listing.currency,
            coalesce(p_trade_item_ids, '{}'), p_message, 'pending')
    returning * into v_offer;
  insert into public.domain_events (actor_id, type, entity, entity_id, payload)
    values (v_uid, 'offer.created', 'offer', v_offer.id, jsonb_build_object('type', p_type::text));
  return v_offer;
end; $$;
grant execute on function public.create_offer(uuid, public.offer_type, numeric, uuid[], text) to authenticated;
create or replace function public.buy_now(p_listing_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.marketplace_listings;
  v_uid     uuid := auth.uid();
  v_offer   public.offers;
  v_sibling uuid;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into v_listing from public.marketplace_listings where id = p_listing_id for update;
  if not found then raise exception 'listing_not_found' using errcode = 'P0002'; end if;
  if v_uid = v_listing.seller_id then raise exception 'cannot_buy_own_listing' using errcode = 'P0001'; end if;
  if v_listing.status <> 'active' then raise exception 'listing_not_available' using errcode = 'P0001'; end if;
  if v_listing.listing_type = 'trade' then raise exception 'not_for_sale' using errcode = 'P0001'; end if;

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
grant execute on function public.buy_now(uuid) to authenticated;

notify pgrst, 'reload schema';
