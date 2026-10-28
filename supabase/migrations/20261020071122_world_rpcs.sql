-- 0013_world_rpcs — MV-W01-05, F-27, 07-collectors-world.md §6.2 (server authority, P4), D-021.
--
-- The only ways a World garage is created, levelled up, or an item enters an inventory. Each is
-- SECURITY DEFINER, authenticated as the caller (auth.uid()), and every token movement goes
-- through the existing spend_tokens() (rule 8 / D-021 — token_ledger is never written here).
-- Eligibility (XP tier gate, min_level, earned-only, durable uniqueness) is checked in the same
-- transaction as the spend, so a client can never assert an amount or skip a gate.
-- Separate file from 0012 on purpose: the enum values added there can't be referenced in the
-- same transaction they were added in.

-- ---------- ensure_world_garage: lazy 1:1 creation (07 §2.1) ----------
create or replace function public.ensure_world_garage()
returns public.world_garages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_row  public.world_garages;
  v_name text;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;

  select * into v_row from public.world_garages where user_id = v_uid;
  if found then return v_row; end if;

  select left(coalesce(nullif(trim(display_name), ''), 'My'), 30) || '''s Garage' into v_name
    from public.profiles where id = v_uid;
  if v_name is null then raise exception 'user_not_found' using errcode = 'P0002'; end if;

  insert into public.world_garages (user_id, name) values (v_uid, v_name)
    on conflict (user_id) do nothing;
  select * into v_row from public.world_garages where user_id = v_uid;

  perform public.emit_event(v_uid, 'world.garage_created', 'garage', v_uid,
    jsonb_build_object('level', v_row.level));
  return v_row;
end; $$;
grant execute on function public.ensure_world_garage() to authenticated;

-- ---------- buy_world_level: next level, XP-gated, paid via spend_tokens ----------
-- Idempotency key = user + target level: a double-submit can't charge twice for the same step.
-- Levels are bought one at a time (07 §3.2 prices are per step).
create or replace function public.buy_world_level()
returns public.world_garages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_garage   public.world_garages;
  v_next     public.world_levels;
  v_xp_level integer;
  v_from     integer;
  v_grant    public.entitlement_grants;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  perform public.ensure_world_garage();

  select * into v_garage from public.world_garages where user_id = v_uid for update;
  v_from := v_garage.level;

  select * into v_next from public.world_levels where level = v_from + 1;
  if not found then raise exception 'max_level' using errcode = 'P0001'; end if;

  select level into v_xp_level from public.profiles where id = v_uid;
  if coalesce(v_xp_level, 0) < v_next.min_xp_level then
    raise exception 'xp_level_too_low' using errcode = 'P0001';
  end if;

  if v_next.price > 0 then
    -- spend_tokens raises insufficient_balance itself; nothing below runs in that case.
    v_grant := public.spend_tokens(
      'spend_garage_level', v_next.price, 'world_level', 1, null,
      'world_level', null, 'world_level:' || v_uid::text || ':' || v_next.level::text
    );
  end if;

  perform set_config('mv.world_rpc', 'on', true);
  update public.world_garages set level = v_next.level where user_id = v_uid returning * into v_garage;
  perform set_config('mv.world_rpc', 'off', true);

  perform public.emit_event(v_uid, 'world.level_up', 'garage', v_uid, jsonb_build_object(
    'from', v_from, 'to', v_next.level, 'price', v_next.price, 'ledger_id', v_grant.ledger_id
  ));
  return v_garage;
end; $$;
grant execute on function public.buy_world_level() to authenticated;

-- ---------- buy_world_item: shop purchase (07 §2.6) ----------
-- earned-only (price NULL) items are never purchasable; durable kinds (everything but
-- `consumable`) are one-per-user and idempotent on user+item; consumables take an optional
-- caller key (p_key) so a retried request doesn't double-charge either.
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

  perform public.emit_event(v_uid, 'world.item_bought', 'world_item', p_item_id, jsonb_build_object(
    'sku', v_item.sku, 'kind', v_item.kind, 'price', v_item.price,
    'inventory_id', v_inv.id, 'ledger_id', v_grant.ledger_id
  ));
  return v_inv;
end; $$;
grant execute on function public.buy_world_item(uuid, text) to authenticated;

notify pgrst, 'reload schema';
