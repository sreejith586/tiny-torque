-- 0013a_world_slots — MV-W02-04 (slot integrity consumer) + the backend half of MV-W02-05 (extra
-- display slots, paid rename, theme ownership), F-20/F-27, 07 §2.1/§3.2, 03 §2.24–2.27.
--
-- Still dark (D-028): no screen reads any of this until the W02 design pack lands (D-074).
-- Additive only (D-006): new columns with defaults, one seeded data row, replaced function bodies,
-- new triggers. Every token movement still goes through spend_tokens (D-021); every garage
-- column the economy depends on stays RPC-only (07 P4, D-071).
--
-- Two things this migration fixes about the event log on the way (rule 9): collection_items
-- had no `item.deleted` / `item.restored` / `item.made_public` / `item.made_private` emission
-- anywhere (S8 added `item.created`), so the consumer 08 asks for had nothing to consume.

-- ---------- capacity: extra display slots beyond the level (07 §3.2 "max per level") ----------
alter table public.world_levels
  add column if not exists max_extra_slots integer not null default 0 check (max_extra_slots >= 0);
-- PLACEHOLDER caps (same status as the level prices, D-070/D-064).
update public.world_levels set max_extra_slots =
  case level when 1 then 2 when 2 then 3 when 3 then 4 when 4 then 5 else 6 end;
-- S8 (D-079) numbers XP tiers 1–6 (1 = Rookie at 0 XP, 2 = Collector at 100 XP …); 0012's seed
-- assumed 0-based tiers. Re-align: garage level n needs XP tier n (level 1 is the free start).
update public.world_levels set min_xp_level = level;

alter table public.world_garages
  add column if not exists extra_slots  integer not null default 0 check (extra_slots >= 0),
  add column if not exists rename_count integer not null default 0 check (rename_count >= 0);

-- Mechanics as data rows (07 §3.3 "pricing is data"): the extra slot is a consumable item with an
-- `effect.grants` the purchase RPC understands; the rename price lives on an item row the rename
-- RPC reads (active so the shop can show the price, but buy_world_item refuses it — see below).
insert into public.world_items (sku, kind, name, description, price, min_level, active, effect, sort_order) values
  ('extra_display_slot', 'consumable', 'Extra display slot', 'One more car on show, beyond what your level gives you.', 15, 1, true,  '{"grants": "display_slot"}', 1000),
  ('garage_rename',      'consumable', 'Garage rename',      'Rename your garage. The first one is free.',               5,  1, true,  '{"grants": "rename"}',       1001)
on conflict (sku) do nothing;

-- ---------- guard: RPC-only columns + theme ownership ----------
-- Replaces 0012's guard. `name` joins level/score because renames are priced (first free), and
-- extra_slots/rename_count are purchase bookkeeping. theme_item_id stays owner-editable but must
-- be a `theme` the owner holds in world_inventory (a W01 PROGRESS-WORLD blocker). Definer so the
-- ownership lookup is not subject to the caller's RLS view of inactive items.
create or replace function public.world_garages_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.level is distinct from old.level
      or new.score is distinct from old.score
      or new.extra_slots is distinct from old.extra_slots
      or new.rename_count is distinct from old.rename_count
      or new.name is distinct from old.name
      or new.user_id <> old.user_id)
     and current_setting('mv.world_rpc', true) is distinct from 'on' then
    raise exception 'rpc_only_column' using errcode = '42501',
      hint = 'level/score/extra_slots/rename_count/name change only through the World RPCs';
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

-- ---------- buy_world_item: + display-slot grants (replaces 0013's body, otherwise identical) ----------
create or replace function public.buy_world_item(p_item_id uuid, p_key text default null)
returns public.world_inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_garage  public.world_garages;
  v_item    public.world_items;
  v_grants  text;
  v_cap     integer;
  v_durable boolean;
  v_key     text;
  v_grant   public.entitlement_grants;
  v_inv     public.world_inventory;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  perform public.ensure_world_garage();
  select * into v_garage from public.world_garages where user_id = v_uid for update;

  select * into v_item from public.world_items where id = p_item_id and active;
  if not found then raise exception 'item_not_found' using errcode = 'P0002'; end if;
  if v_item.price is null then raise exception 'earned_only' using errcode = 'P0001'; end if;
  if v_garage.level < v_item.min_level then raise exception 'level_too_low' using errcode = 'P0001'; end if;

  v_grants := v_item.effect ->> 'grants';
  if v_grants = 'rename' then raise exception 'item_not_found' using errcode = 'P0002'; end if; -- rename_world_garage only
  if v_grants = 'display_slot' then
    select max_extra_slots into v_cap from public.world_levels where level = v_garage.level;
    if v_garage.extra_slots >= coalesce(v_cap, 0) then
      raise exception 'slot_cap_reached' using errcode = 'P0001';
    end if;
  end if;

  v_durable := v_item.kind <> 'consumable';
  if v_durable and exists (
    select 1 from public.world_inventory where user_id = v_uid and item_id = p_item_id and durable
  ) then
    raise exception 'already_owned' using errcode = 'P0001';
  end if;

  v_key := coalesce(p_key, case when v_durable then 'world_item:' || v_uid::text || ':' || p_item_id::text end);
  if v_item.price > 0 then
    v_grant := public.spend_tokens(
      'spend_world_item', v_item.price, 'world_item', 1, null, 'world_item', p_item_id, v_key
    );
  end if;

  insert into public.world_inventory (user_id, item_id, acquired_via, ledger_id, durable)
    values (v_uid, p_item_id, 'purchase', v_grant.ledger_id, v_durable)
    returning * into v_inv;

  if v_grants = 'display_slot' then
    perform set_config('mv.world_rpc', 'on', true);
    update public.world_garages set extra_slots = extra_slots + 1 where user_id = v_uid;
    perform set_config('mv.world_rpc', 'off', true);
  end if;

  perform public.emit_event(v_uid, 'world.item_bought', 'world_item', p_item_id, jsonb_build_object(
    'sku', v_item.sku, 'kind', v_item.kind, 'price', v_item.price, 'grants', v_grants,
    'inventory_id', v_inv.id, 'ledger_id', v_grant.ledger_id
  ));
  return v_inv;
end; $$;

-- ---------- rename_world_garage: first rename free, then priced (07 §3.2) ----------
create or replace function public.rename_world_garage(p_name text)
returns public.world_garages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_name   text := nullif(trim(p_name), '');
  v_garage public.world_garages;
  v_price  integer;
  v_grant  public.entitlement_grants;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if v_name is null or char_length(v_name) > 40 then raise exception 'invalid_name' using errcode = 'P0001'; end if;
  perform public.ensure_world_garage();
  select * into v_garage from public.world_garages where user_id = v_uid for update;

  if v_garage.rename_count > 0 then
    select price into v_price from public.world_items where sku = 'garage_rename';
    if coalesce(v_price, 0) > 0 then
      v_grant := public.spend_tokens(
        'spend_rename', v_price, 'world_item', 1, null, 'world_rename', null,
        'world_rename:' || v_uid::text || ':' || v_garage.rename_count::text
      );
    end if;
  end if;

  perform set_config('mv.world_rpc', 'on', true);
  update public.world_garages set name = v_name, rename_count = rename_count + 1
    where user_id = v_uid returning * into v_garage;
  perform set_config('mv.world_rpc', 'off', true);

  perform public.emit_event(v_uid, 'world.garage_updated', 'garage', v_uid, jsonb_build_object(
    'fields', jsonb_build_array('name'), 'price', coalesce(v_price, 0), 'ledger_id', v_grant.ledger_id
  ));
  return v_garage;
end; $$;
grant execute on function public.rename_world_garage(text) to authenticated;

-- ---------- item visibility events (rule 9 gap) ----------
-- AFTER UPDATE OR DELETE on collection_items, atomic with the write (same shape as S8's
-- collection_items_emit_created). A hard delete carries `hard: true` so consumers can tell.
create or replace function public.emit_item_visibility_events() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (old.owner_id, 'item.deleted', 'item', old.id, jsonb_build_object('hard', true));
    return old;
  end if;
  if new.deleted_at is not null and old.deleted_at is null then
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (new.owner_id, 'item.deleted', 'item', new.id, jsonb_build_object('hard', false));
  elsif new.deleted_at is null and old.deleted_at is not null then
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (new.owner_id, 'item.restored', 'item', new.id, '{}'::jsonb);
  end if;
  if new.is_public is distinct from old.is_public and new.deleted_at is null then
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (new.owner_id, case when new.is_public then 'item.made_public' else 'item.made_private' end,
              'item', new.id, '{}'::jsonb);
  end if;
  return new;
end; $$;
create trigger collection_items_emit_visibility
  after update or delete on public.collection_items
  for each row execute function public.emit_item_visibility_events();

-- ---------- slot integrity consumer (07 §2.1 marketplace bridge, MV-W02-04) ----------
-- Removes an item from its owner's display slots + featured car when it stops being displayable
-- (deleted, made private, or sold: offer.completed on the seller side). The buyer gets a 'park it'
-- stub notification — only if they already have a World garage, so nothing surfaces while dark.
create or replace function public.world_remove_item_from_garage(p_user uuid, p_item uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_changed boolean := false;
begin
  update public.world_garages set
    featured_item_id = case when featured_item_id = p_item then null else featured_item_id end,
    layout = jsonb_set(
      layout, '{slots}',
      coalesce((
        select jsonb_agg(s) from jsonb_array_elements(coalesce(layout -> 'slots', '[]'::jsonb)) s
        where s ->> 'itemId' <> p_item::text
      ), '[]'::jsonb)
    )
  where user_id = p_user
    and (featured_item_id = p_item
         or coalesce(layout -> 'slots', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('itemId', p_item::text)));
  v_changed := found;
  if v_changed then
    perform public.emit_event(p_user, 'world.garage_updated', 'garage', p_user,
      jsonb_build_object('fields', jsonb_build_array('layout', 'featured_item_id'),
                         'reason', 'slot_integrity', 'item_id', p_item));
  end if;
  return v_changed;
end; $$;

create or replace function public.world_slot_integrity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_item  uuid;
  v_owner uuid;
  v_offer public.offers;
begin
  if new.entity = 'item' and new.type in ('item.deleted', 'item.made_private') then
    v_item := new.entity_id;
    select owner_id into v_owner from public.collection_items where id = v_item;
    v_owner := coalesce(v_owner, new.actor_id); -- hard delete: the row is gone, the actor owned it
    perform public.world_remove_item_from_garage(v_owner, v_item);
  elsif new.entity = 'offer' and new.type = 'offer.completed' then
    select * into v_offer from public.offers where id = new.entity_id;
    if not found then return new; end if;
    select source_item_id into v_item from public.marketplace_listings where id = v_offer.listing_id;
    if v_item is null then return new; end if;
    perform public.world_remove_item_from_garage(v_offer.seller_id, v_item);
    if exists (select 1 from public.world_garages where user_id = v_offer.buyer_id) then
      insert into public.notifications (user_id, type, payload)
        values (v_offer.buyer_id, 'system', jsonb_build_object(
          'kind', 'world_park_it', 'item_id', v_item, 'listing_id', v_offer.listing_id, 'offer_id', v_offer.id));
    end if;
  end if;
  return new;
end; $$;
create trigger world_slot_integrity
  after insert on public.domain_events
  for each row execute function public.world_slot_integrity();

notify pgrst, 'reload schema';
