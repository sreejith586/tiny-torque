-- 0004_garage_v2 — MV-S2-03, F-02, 03-data-model.md §2.4
--
-- Additive garage upgrade: new collection_items columns, a generated full-text `search` vector,
-- and the indexes the server-side list/search/sort needs. Also defines the item enum TYPES.
--
-- Deliberately NOT in this migration (kept green + D-006):
--   * Converting the existing text `condition`/`rarity` columns and introducing `packaging` from
--     the legacy `card_type` is done together with the domain/garage rewrite (MV-S2-04) so the
--     generated TS types and the service change land in lockstep — converting here would break
--     the current insert path's types before the service is ready.
--   * Dropping `photo`/`photos` is a SECOND migration after the backfill is verified on prod
--     (D-006 two-release rule); `collection_items_v1` (0003) covers readers meanwhile.
--   * The `catalog_model_id` FK to `catalog_models` is added in S3-01 (0005) when that table
--     exists; here it is a plain nullable uuid so the column + its index are ready early.

-- ---------- item enum types (used by the service now; column conversions land in MV-S2-04) ----------
create type public.item_condition as enum ('mint', 'near-mint', 'good', 'played', 'damaged');
create type public.item_packaging as enum ('carded', 'blister', 'loose', 'boxed');
create type public.item_rarity as enum ('common', 'uncommon', 'rare', 'super-rare', 'treasure-hunt', 'chase');

-- ---------- new scalar columns ----------
alter table public.collection_items
  add column if not exists catalog_model_id uuid,
  add column if not exists color text,
  add column if not exists is_favorite boolean not null default false,
  add column if not exists notes text,
  add column if not exists currency char(3);

-- ---------- generated full-text search vector ----------
-- 'simple' (no stemming) suits proper nouns like brand/model/series names ("Skyline", "GT-R").
alter table public.collection_items
  add column if not exists search tsvector generated always as (
    to_tsvector(
      'simple',
      coalesce(brand, '') || ' ' ||
      coalesce(model, '') || ' ' ||
      coalesce(series, '') || ' ' ||
      coalesce(variant, '') || ' ' ||
      coalesce(color, '')
    )
  ) stored;

-- ---------- indexes (server-side list/search/sort/filter) ----------
create index if not exists collection_items_owner_deleted_idx on public.collection_items (owner_id, deleted_at);
create index if not exists collection_items_owner_brand_idx on public.collection_items (owner_id, brand);
create index if not exists collection_items_search_idx on public.collection_items using gin (search);
create index if not exists collection_items_catalog_model_idx on public.collection_items (catalog_model_id);

notify pgrst, 'reload schema';
