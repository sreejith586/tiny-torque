-- pgTAP for 0013a_world_slots (MV-W02-04/05 backend, F-20/F-27). Item visibility events, the slot
-- integrity consumer (private / soft-delete / hard-delete / sold), the buyer 'park it' stub (only
-- for buyers who have a garage), extra display slots with the per-level cap, the first-free-then-
-- paid rename, the RPC-only name column, and the theme ownership guard. Run via CI's pgTAP job.

begin;
select plan(31);

insert into auth.users (id) values
  ('72000000-0000-0000-0000-00000000000a'),
  ('72000000-0000-0000-0000-00000000000b'),
  ('72000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, display_name, account_type, handle, plan, role, tokens, level) values
  ('72000000-0000-0000-0000-00000000000a', 'Owner',  'individual', 's_owner',  'free', 'user', 0, 0),
  ('72000000-0000-0000-0000-00000000000b', 'BuyerG', 'individual', 's_buyerg', 'free', 'user', 0, 0),
  ('72000000-0000-0000-0000-00000000000c', 'BuyerN', 'individual', 's_buyern', 'free', 'user', 0, 0);
insert into public.collection_items (id, owner_id, brand, model, is_public) values
  ('72000000-0000-0000-0000-0000000000a1', '72000000-0000-0000-0000-00000000000a', 'HW', 'X', true),
  ('72000000-0000-0000-0000-0000000000a2', '72000000-0000-0000-0000-00000000000a', 'HW', 'Y', true),
  ('72000000-0000-0000-0000-0000000000a3', '72000000-0000-0000-0000-00000000000a', 'HW', 'Z', true);
insert into public.world_items (id, sku, kind, name, price, min_level, active) values
  ('72000000-0000-0000-0000-0000000000f0', 's_theme', 'theme', 'Theme', 25, 1, true),
  ('72000000-0000-0000-0000-0000000000f1', 's_lamp',  'decor', 'Lamp',  10, 1, true);
-- Owner's garage: X featured + in slot 0, Y in slot 1. BuyerG has a garage, BuyerN does not.
insert into public.world_garages (user_id, level, name, featured_item_id, layout) values
  ('72000000-0000-0000-0000-00000000000a', 1, 'Owner garage', '72000000-0000-0000-0000-0000000000a1',
   '{"version":1,"slots":[{"slot":0,"itemId":"72000000-0000-0000-0000-0000000000a1"},{"slot":1,"itemId":"72000000-0000-0000-0000-0000000000a2"}],"decor":[]}'),
  ('72000000-0000-0000-0000-00000000000b', 1, 'Buyer garage', null, '{"version":1,"slots":[],"decor":[]}');

create schema if not exists tests;
create or replace function tests.authenticate_as(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end; $$;
create or replace function tests.clear_authentication() returns void language plpgsql as $$
begin
  perform set_config('role', 'supabase_admin', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end; $$;
create or replace function tests.slot_items(p_user uuid) returns text language sql as $$
  select coalesce(string_agg(s ->> 'itemId', ',' order by (s ->> 'slot')::int), '')
  from public.world_garages g, jsonb_array_elements(g.layout -> 'slots') s where g.user_id = p_user;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------- item.made_private → out of slots + featured ----------
update public.collection_items set is_public = false where id = '72000000-0000-0000-0000-0000000000a1';
select is((select count(*)::int from public.domain_events where type = 'item.made_private'
  and entity_id = '72000000-0000-0000-0000-0000000000a1'), 1, 'making an item private emits item.made_private');
select is(tests.slot_items('72000000-0000-0000-0000-00000000000a'),
  '72000000-0000-0000-0000-0000000000a2', 'a private item leaves the display slots');
select is((select featured_item_id from public.world_garages where user_id = '72000000-0000-0000-0000-00000000000a'),
  null, 'a private item is no longer the featured car');
select is((select count(*)::int from public.domain_events where type = 'world.garage_updated'
  and payload ->> 'reason' = 'slot_integrity'), 1, 'the consumer logs the layout change as world.garage_updated');
-- making it public again does not re-add it (the owner places cars; the consumer only removes)
update public.collection_items set is_public = true where id = '72000000-0000-0000-0000-0000000000a1';
select is((select count(*)::int from public.domain_events where type = 'item.made_public'), 1, 'item.made_public is emitted');
select is(tests.slot_items('72000000-0000-0000-0000-00000000000a'),
  '72000000-0000-0000-0000-0000000000a2', 'making it public again does not re-place it');

-- ---------- soft delete / restore ----------
update public.collection_items set deleted_at = now() where id = '72000000-0000-0000-0000-0000000000a2';
select is((select payload ->> 'hard' from public.domain_events where type = 'item.deleted'
  and entity_id = '72000000-0000-0000-0000-0000000000a2'), 'false', 'a soft delete emits item.deleted hard=false');
select is(tests.slot_items('72000000-0000-0000-0000-00000000000a'), '', 'a soft-deleted item leaves the slots');
update public.collection_items set deleted_at = null where id = '72000000-0000-0000-0000-0000000000a2';
select is((select count(*)::int from public.domain_events where type = 'item.restored'), 1, 'restoring emits item.restored');

-- ---------- offer.completed → seller side removal + buyer 'park it' stub ----------
update public.world_garages set
  layout = '{"version":1,"slots":[{"slot":0,"itemId":"72000000-0000-0000-0000-0000000000a2"}],"decor":[]}',
  featured_item_id = '72000000-0000-0000-0000-0000000000a2'
  where user_id = '72000000-0000-0000-0000-00000000000a';
insert into public.marketplace_listings (id, seller_id, source_item_id, brand, status, price, currency, listing_type, open_to_offers, min_offer) values
  ('72000000-0000-0000-0000-0000000000e0', '72000000-0000-0000-0000-00000000000a', '72000000-0000-0000-0000-0000000000a2', 'HW', 'sold', 100, 'AED', 'sale', false, null),
  ('72000000-0000-0000-0000-0000000000e1', '72000000-0000-0000-0000-00000000000a', '72000000-0000-0000-0000-0000000000a1', 'HW', 'sold', 100, 'AED', 'sale', false, null);
insert into public.offers (id, listing_id, buyer_id, seller_id, type, amount, status) values
  ('72000000-0000-0000-0000-0000000000d0', '72000000-0000-0000-0000-0000000000e0', '72000000-0000-0000-0000-00000000000b', '72000000-0000-0000-0000-00000000000a', 'cash', 100, 'completed'),
  ('72000000-0000-0000-0000-0000000000d1', '72000000-0000-0000-0000-0000000000e1', '72000000-0000-0000-0000-00000000000c', '72000000-0000-0000-0000-00000000000a', 'cash', 100, 'completed');
insert into public.domain_events (actor_id, type, entity, entity_id, payload) values
  ('72000000-0000-0000-0000-00000000000a', 'offer.completed', 'offer', '72000000-0000-0000-0000-0000000000d0', '{}');
select is(tests.slot_items('72000000-0000-0000-0000-00000000000a'), '', 'a sold car leaves the seller''s slots');
select is((select featured_item_id from public.world_garages where user_id = '72000000-0000-0000-0000-00000000000a'),
  null, 'a sold car is no longer the seller''s featured car');
select is((select count(*)::int from public.notifications where user_id = '72000000-0000-0000-0000-00000000000b'
  and type = 'system' and payload ->> 'kind' = 'world_park_it'), 1, 'a buyer with a garage gets the park-it stub');
insert into public.domain_events (actor_id, type, entity, entity_id, payload) values
  ('72000000-0000-0000-0000-00000000000a', 'offer.completed', 'offer', '72000000-0000-0000-0000-0000000000d1', '{}');
select is((select count(*)::int from public.notifications where user_id = '72000000-0000-0000-0000-00000000000c'
  and payload ->> 'kind' = 'world_park_it'), 0, 'a buyer without a garage gets nothing (dark)');

-- ---------- hard delete (Z is referenced by no listing, so the row can actually go) ----------
update public.world_garages set
  layout = '{"version":1,"slots":[{"slot":0,"itemId":"72000000-0000-0000-0000-0000000000a3"}],"decor":[]}'
  where user_id = '72000000-0000-0000-0000-00000000000a';
delete from public.collection_items where id = '72000000-0000-0000-0000-0000000000a3';
select is((select payload ->> 'hard' from public.domain_events where type = 'item.deleted'
  and entity_id = '72000000-0000-0000-0000-0000000000a3'), 'true', 'a hard delete emits item.deleted hard=true');
select is(tests.slot_items('72000000-0000-0000-0000-00000000000a'), '', 'a hard-deleted item leaves the slots');

-- ---------- extra display slots: priced consumable, capped per level ----------
select public.credit_tokens('72000000-0000-0000-0000-00000000000a', 100, 'purchase', 'token_purchase', null, 's_evt_1');
select tests.authenticate_as('72000000-0000-0000-0000-00000000000a');
select is((select durable from public.buy_world_item((select id from public.world_items where sku = 'extra_display_slot'), 'slot_1')),
  false, 'an extra slot is a consumable purchase');
select public.buy_world_item((select id from public.world_items where sku = 'extra_display_slot'), 'slot_2');
select throws_ok(
  $$select public.buy_world_item((select id from public.world_items where sku = 'extra_display_slot'), 'slot_3')$$,
  'P0001', 'slot_cap_reached', 'level 1 allows two extra slots (placeholder cap)');
select tests.clear_authentication();
select is((select extra_slots from public.world_garages where user_id = '72000000-0000-0000-0000-00000000000a'),
  2, 'extra_slots counts the purchases');
select is((select tokens from public.profiles where id = '72000000-0000-0000-0000-00000000000a'),
  70, 'two slots cost 2 × 15');
select is((select payload ->> 'grants' from public.domain_events where type = 'world.item_bought' limit 1),
  'display_slot', 'world.item_bought carries what the item grants');

-- ---------- rename: first free, then priced; never a direct column write ----------
select tests.authenticate_as('72000000-0000-0000-0000-00000000000a');
select is((select name from public.rename_world_garage('  Showcase  ')), 'Showcase', 'the first rename is applied (trimmed)');
select tests.clear_authentication();
select is((select tokens from public.profiles where id = '72000000-0000-0000-0000-00000000000a'), 70, 'the first rename is free');
select tests.authenticate_as('72000000-0000-0000-0000-00000000000a');
select is((select rename_count from public.rename_world_garage('Showcase II')), 2, 'the second rename increments rename_count');
select tests.clear_authentication();
select is((select tokens from public.profiles where id = '72000000-0000-0000-0000-00000000000a'), 65, 'the second rename costs the garage_rename price (5)');
select is((select count(*)::int from public.token_ledger where reason = 'spend_rename'), 1, 'the paid rename is a spend_rename ledger row');
select tests.authenticate_as('72000000-0000-0000-0000-00000000000a');
select throws_ok($$select public.rename_world_garage('   ')$$, 'P0001', 'invalid_name', 'an empty name is rejected');
select throws_ok(
  $$update public.world_garages set name = 'free rename' where user_id = '72000000-0000-0000-0000-00000000000a'$$,
  '42501', 'rpc_only_column', 'the owner cannot rename by direct update (priced column)');

-- ---------- theme ownership guard ----------
select throws_ok(
  $$update public.world_garages set theme_item_id = '72000000-0000-0000-0000-0000000000f0' where user_id = '72000000-0000-0000-0000-00000000000a'$$,
  'P0001', 'theme_not_owned', 'a theme the owner does not hold is rejected');
select public.buy_world_item('72000000-0000-0000-0000-0000000000f0');
select public.buy_world_item('72000000-0000-0000-0000-0000000000f1');
select lives_ok(
  $$update public.world_garages set theme_item_id = '72000000-0000-0000-0000-0000000000f0' where user_id = '72000000-0000-0000-0000-00000000000a'$$,
  'an owned theme can be applied');
select throws_ok(
  $$update public.world_garages set theme_item_id = '72000000-0000-0000-0000-0000000000f1' where user_id = '72000000-0000-0000-0000-00000000000a'$$,
  'P0001', 'theme_not_owned', 'an owned decor item is not a theme');
select lives_ok(
  $$update public.world_garages set theme_item_id = null where user_id = '72000000-0000-0000-0000-00000000000a'$$,
  'the theme can be cleared');

select * from finish();
rollback;
