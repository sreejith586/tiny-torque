-- 0006_marketplace_v2 — MV-S4-01, F-06/F-07, 03-data-model.md §2.6/2.10/2.11, ADR-06
--
-- Listings rewrite (release 1 of 2, per D-006). This migration is ADDITIVE: it adds the v2 columns,
-- the favourites table, wishlist fields, the active-listing-limit trigger + entitlement function,
-- and — importantly — closes the rule-15 PII hole by revoking column access to `seller_mobile`
-- for anon/authenticated. It does NOT drop the legacy denormalised columns (`seller_*`, `offers`
-- jsonb, `photo`/`photos`): that destructive step ships as release 2 after the read path moves to
-- public_profiles joins + media references (S4-02), mirroring how garage_v2 deferred its `photos`
-- drop. Everything stays dark behind the `marketplace_publish` flag (seeded OFF, D-018).

-- ---------- enums ----------
create type public.listing_type as enum ('sale', 'trade', 'both');

-- ---------- marketplace_listings: v2 columns (additive) ----------
alter table public.marketplace_listings
  add column if not exists catalog_model_id uuid references public.catalog_models(id) on delete set null,
  add column if not exists listing_type   public.listing_type not null default 'sale',
  add column if not exists currency       char(3) not null default 'AED',
  add column if not exists country_code   char(2) references public.countries(code),
  add column if not exists min_offer      numeric(10, 2),
  add column if not exists description    text,
  add column if not exists view_count     integer not null default 0,
  add column if not exists favorite_count integer not null default 0,
  add column if not exists offer_count    integer not null default 0,
  add column if not exists expires_at     timestamptz,
  add column if not exists sold_at        timestamptz,
  -- sold_offer_id references offers(id); the FK is added with the offers table in S5 (0007).
  -- (updated_at / deleted_at + their set_updated_at trigger already exist from housekeeping.)
  add column if not exists sold_offer_id  uuid,
  add column if not exists search tsvector generated always as (
    to_tsvector('simple', coalesce(brand, '') || ' ' || coalesce(model, '') || ' ' || coalesce(variant, ''))
  ) stored;

-- backfill sensible values for any pre-existing rows
update public.marketplace_listings l
  set country_code = coalesce(l.country_code, p.country_code)
  from public.profiles p
  where l.seller_id = p.id and l.country_code is null;
update public.marketplace_listings
  set listing_type = (case when open_to_trade then 'both' else 'sale' end)::public.listing_type
  where listing_type = 'sale' and open_to_trade;
update public.marketplace_listings set min_offer = price where min_offer is null;
update public.marketplace_listings set expires_at = created_at + interval '60 days' where expires_at is null;

create index if not exists marketplace_listings_search_idx
  on public.marketplace_listings using gin (search);
create index if not exists marketplace_listings_country_status_idx
  on public.marketplace_listings (country_code, status, created_at desc);
create index if not exists marketplace_listings_catalog_model_idx
  on public.marketplace_listings (catalog_model_id);
create index if not exists marketplace_listings_expires_idx
  on public.marketplace_listings (expires_at) where status = 'active';

-- ---------- rule-15 PII fix: anon/authenticated must never read seller_mobile ----------
-- RLS is row-level, so we restrict at the column grant instead (the column itself survives until
-- the release-2 drop). Built from the live column list so it stays correct as columns are added.
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ')
    into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'marketplace_listings'
    and column_name <> 'seller_mobile';
  execute 'revoke select on public.marketplace_listings from anon, authenticated';
  execute format('grant select (%s) on public.marketplace_listings to anon, authenticated', cols);
end $$;

-- ---------- entitlements: active-listing slots (D-003/D-021) ----------
-- Base plan only for now (free 2 / Pro unlimited) — PLACEHOLDER, like entitlement_scan_quota;
-- purchased listing-slot grants sum in here in S7 (MV-S7-07, relates to D-024 pricing).
create or replace function public.is_pro(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select plan = 'pro' from public.profiles where id = p_user), false);
$$;

create or replace function public.entitlement_listing_slots(p_user uuid)
returns integer language sql stable security definer set search_path = public as $$
  select case when public.is_pro(p_user) then 2147483647 else 2 end;
$$;

-- DB backstop for the limit (UI asks entitlements first, D-021). Counts the seller's other active,
-- non-deleted listings; blocks the insert/update that would exceed their slots.
create or replace function public.enforce_active_listing_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare active_count integer; slots integer;
begin
  if new.status = 'active' and new.deleted_at is null then
    select count(*) into active_count
      from public.marketplace_listings
      where seller_id = new.seller_id and status = 'active' and deleted_at is null and id <> new.id;
    slots := public.entitlement_listing_slots(new.seller_id);
    if active_count >= slots then
      raise exception 'listing_limit_reached' using errcode = 'P0001';
    end if;
  end if;
  return new;
end; $$;
create trigger enforce_active_listing_limit
  before insert or update on public.marketplace_listings
  for each row execute function public.enforce_active_listing_limit();

-- ---------- listing_favorites (new) + favorite_count trigger (F-07) ----------
create table public.listing_favorites (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
alter table public.listing_favorites enable row level security;
create policy "Users manage their own favourites" on public.listing_favorites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create index listing_favorites_listing_idx on public.listing_favorites (listing_id);
grant select, insert, delete on public.listing_favorites to authenticated;

create or replace function public.sync_listing_favorite_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.marketplace_listings set favorite_count = favorite_count + 1 where id = new.listing_id;
  elsif tg_op = 'DELETE' then
    update public.marketplace_listings set favorite_count = greatest(0, favorite_count - 1) where id = old.listing_id;
  end if;
  return null;
end; $$;
create trigger sync_listing_favorite_count after insert or delete on public.listing_favorites
  for each row execute function public.sync_listing_favorite_count();

-- ---------- wishlist_items: v2 fields (F-07) ----------
alter table public.wishlist_items
  add column if not exists catalog_model_id uuid references public.catalog_models(id) on delete set null,
  add column if not exists max_price        numeric(10, 2),
  add column if not exists currency         char(3),
  add column if not exists notify           boolean not null default true;

-- baseline gave wishlist select/insert/delete (owner-only); add the matching update policy for the
-- new editable fields (max_price / notify).
create policy "Users update their own wishlist" on public.wishlist_items for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

notify pgrst, 'reload schema';
