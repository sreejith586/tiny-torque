-- 0017_notifications_v2 — MV-S6-06, F-12.
--
-- Extends the existing offer-events consumer (20261003030000_notify_offers.sql) to also turn a
-- deal_messages.sent event into a `message` notification for the OTHER party, and retrofits a
-- `review.created` domain_events row (missing from 20261013000000's seller_reviews trigger — rule
-- 9 says every mutation emits one, this one slipped through since reviews go via a plain insert,
-- not a service-layer emitEvent call) into a `review_received` notification for the seller.
-- `report.created` is deliberately a no-op here — reports feed the admin queue (MV-S6-07) directly,
-- there's no end-user notification_type for "someone reported something" and shouldn't be one.

create or replace function public.notify_on_offer_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer     public.offers;
  v_recipient uuid;
  v_type      public.notification_type;
begin
  if new.entity = 'offer' and new.type like 'offer.%' then
    if new.type = 'offer.created' then v_type := 'offer_received';
    elsif new.type = 'offer.accepted' then v_type := 'offer_accepted';
    elsif new.type = 'offer.declined' then v_type := 'offer_declined';
    elsif new.type = 'offer.completed' then v_type := 'listing_sold';
    else return new; -- no notification for this event type (yet)
    end if;

    select * into v_offer from public.offers where id = new.entity_id;
    if not found then return new; end if;

    v_recipient := case when new.type = 'offer.created' then v_offer.seller_id else v_offer.buyer_id end;
    insert into public.notifications (user_id, type, payload)
      values (v_recipient, v_type, jsonb_build_object('offer_id', v_offer.id, 'listing_id', v_offer.listing_id));
    return new;
  end if;

  if new.entity = 'offer' and new.type = 'message.sent' then
    select * into v_offer from public.offers where id = new.entity_id;
    if not found then return new; end if;

    v_recipient := case when new.actor_id = v_offer.buyer_id then v_offer.seller_id else v_offer.buyer_id end;
    insert into public.notifications (user_id, type, payload)
      values (v_recipient, 'message', jsonb_build_object('offer_id', v_offer.id));
    return new;
  end if;

  if new.entity = 'review' and new.type = 'review.created' then
    insert into public.notifications (user_id, type, payload)
      select sr.seller_id, 'review_received', jsonb_build_object('review_id', sr.id, 'rating', sr.rating)
      from public.seller_reviews sr where sr.id = new.entity_id;
    return new;
  end if;

  return new;
end; $$;

-- review.created: emitted alongside the existing rating recompute, same transaction as the write.
create or replace function public.recompute_seller_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_seller uuid := coalesce(new.seller_id, old.seller_id);
  v_cnt integer;
  v_avg numeric(3,2);
begin
  if tg_op = 'INSERT' then
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (new.buyer_id, 'review.created', 'review', new.id, jsonb_build_object('seller_id', new.seller_id, 'rating', new.rating));
  end if;

  select count(*), avg(rating)::numeric(3,2) into v_cnt, v_avg
    from public.seller_reviews where seller_id = v_seller and deleted_at is null;
  update public.profiles set rating_count = v_cnt, rating_avg = v_avg where id = v_seller;
  return coalesce(new, old);
end; $$;

notify pgrst, 'reload schema';
