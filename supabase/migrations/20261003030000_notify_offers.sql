-- 0007c_notify_offers — MV-S5-06, F-12. Notification consumer for offer events.
--
-- A row AFTER INSERT trigger on domain_events turns each offer.* event into a notifications row
-- for the right recipient (seller for a new offer; buyer for accept/decline/complete). The bell UI
-- + Realtime subscription land in S6; this just produces the rows. Definer so it can insert for any
-- recipient (notifications has no client insert policy); notifications is owned by the same role as
-- this function, so the owner-bypass is consistent with the other offer RPCs.
--
-- Recipients/types are mapped only for the events with a clean notification_type; withdraw / cancel
-- / expire have no dedicated type yet and are intentionally skipped (add when the enum grows).

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
  if new.entity <> 'offer' then return new; end if;

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
end; $$;

create trigger notify_on_offer_event
  after insert on public.domain_events
  for each row execute function public.notify_on_offer_event();

notify pgrst, 'reload schema';
