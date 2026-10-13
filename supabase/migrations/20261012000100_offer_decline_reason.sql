-- MV-S5-04 prerequisite. F-08's /offers inbox AC asks for "auto-decline explanations" — an offer
-- auto-declined because the seller accepted a different one should read differently from one the
-- seller declined by hand. The only record of *why* an offer was declined lived in domain_events,
-- which only admins can read (identity_v2's "Admins read all events" policy) — not useful for the
-- buyer/seller themselves. Adds a small nullable column on offers instead (same RLS as the rest of
-- the row: buyer or seller, D-021) and sets it from the two places that already auto-decline
-- siblings (transition_offer's accept branch, buy_now's auto-decline loop). Re-creates both
-- functions in full rather than editing 20261003010000/20261003020000 (D-006).

alter table public.offers add column decline_reason text;

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
      update public.offers set status = 'declined', responded_at = now(), decline_reason = 'auto_declined' where id = v_sibling;
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
    update public.offers set status = 'declined', responded_at = now(), decline_reason = 'auto_declined' where id = v_sibling;
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
